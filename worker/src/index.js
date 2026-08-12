// Cloudflare Worker backing the Training Tracker PWA.
//
// Endpoints:
//   POST   /feedback        -> creates an issue in the private feedback repo
//   POST   /backup          -> stores an opaque encrypted blob under a slot id
//   GET    /backup?slot=X   -> returns the blob stored under the slot
//   DELETE /backup?slot=X   -> removes the slot
//   POST   /push/schedule   -> schedules a rest-end web push (DO alarm)
//   POST   /push/cancel     -> cancels the pending push for a subscription
//
// Bindings: STORE (KV), PUSH_DO (Durable Object). Vars: GITHUB_REPO,
// ALLOWED_ORIGINS. Secrets: GITHUB_TOKEN, VAPID_PRIVATE_JWK.
//
// Push model: one PushScheduler object per subscription endpoint, holding at
// most one pending notification. Scheduling again replaces it; the DO alarm
// (millisecond precision) encrypts and sends the push at fire time. The
// notification text arrives pre-localized from the app, so the server stays
// content-agnostic, matching the E2EE stance of /backup.
// End-to-end encryption model: the app derives both the 128-bit slot id and an
// AES-GCM key from the user's sync code via PBKDF2 (js/crypto.js in the app).
// This server only ever sees the slot id and ciphertext; it cannot read a
// backup. The slot id is the only credential, so slot paths are rate limited
// per client IP. Slots expire 180 days after the last write (refreshed on
// every backup), which both bounds storage abuse and acts as the stated
// retention policy.

import { buildPushHTTPRequest } from "@pushforge/builder";

const SLOT_RE = /^[0-9a-f]{32}$/;
const SLOT_TTL_SECONDS = 15_552_000; // 180 days
const MAX_BLOB_CHARS = 1_400_000; // ~1MB plaintext after base64 + JSON overhead
const MAX_MESSAGE_CHARS = 5000;
const MAX_CONTACT_CHARS = 200;
const MAX_META_CHARS = 300;
// push: every set schedules (and +30s reschedules), so a long session with a
// short-rest program legitimately makes dozens of calls per hour.
const RATE_LIMITS = { feedback: 5, backup: 20, push: 120 };

const PUSH_TITLE_MAX = 80;
const PUSH_BODY_MAX = 200;
const PUSH_MAX_DELAY_MS = 30 * 60_000; // rest timers are minutes, not hours
const PUSH_PAST_GRACE_MS = 5_000; // clock skew allowance for "fire now"
const PUSH_ENDPOINT_MAX = 1024;
const PUSH_KEY_MAX = 300; // p256dh is ~88 base64 chars, auth ~24
// VAPID contact the push services may use to reach the sender.
const PUSH_ADMIN_CONTACT = "https://c-k-labs.github.io/training-tracker/";
// The DO alarm POSTs to the subscription endpoint. Without this allowlist the
// worker would be a blind POST proxy to any URL a client hands it; only real
// browser push services are accepted.
const PUSH_HOST_ALLOW = [
  { exact: "fcm.googleapis.com" }, // Chrome / Android
  { suffix: ".push.apple.com" }, // Safari / iOS (web.push.apple.com)
  { suffix: ".push.services.mozilla.com" }, // Firefox
  { suffix: ".notify.windows.com" }, // Edge (WNS)
];
// Issue labels must already exist in the repo; map to GitHub's default label set.
const TYPE_LABELS = { bug: "bug", suggestion: "enhancement", other: "question" };

class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get("Origin"), env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (url.pathname === "/feedback" && request.method === "POST") {
        return await handleFeedback(request, env, cors);
      }
      if (url.pathname === "/backup") {
        if (request.method === "POST") return await handleBackupWrite(request, env, cors);
        if (request.method === "GET") return await handleBackupRead(url, request, env, cors);
        if (request.method === "DELETE") return await handleBackupDelete(url, request, env, cors);
      }
      if (url.pathname === "/push/schedule" && request.method === "POST") {
        return await handlePushSchedule(request, env, cors);
      }
      if (url.pathname === "/push/cancel" && request.method === "POST") {
        return await handlePushCancel(request, env, cors);
      }
      throw new ApiError(404, "not_found");
    } catch (err) {
      if (err instanceof ApiError) return json({ ok: false, error: err.code }, err.status, cors);
      return json({ ok: false, error: "internal" }, 500, cors);
    }
  },
};

function corsHeaders(origin, env) {
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

// Per-isolate in-memory rate limiter. Approximate by design: counters reset
// when the isolate recycles and are independent per colo, which is the same
// guarantee Cloudflare's native rate-limit binding gives. Chosen over KV
// counters so abusive traffic cannot burn the KV free-tier write quota.
const RATE_WINDOW_MS = 3_600_000;
const rateBuckets = new Map();

function rateLimit(bucket, ip, limit) {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= limit) throw new ApiError(429, "rate_limited");
  hits.push(now);
  rateBuckets.set(key, hits);
  if (rateBuckets.size > 10_000) {
    // Bound memory under IP-rotation abuse: evict oldest keys.
    for (const k of rateBuckets.keys()) {
      rateBuckets.delete(k);
      if (rateBuckets.size <= 5_000) break;
    }
  }
}

async function readJson(request, maxBytes) {
  if (Number(request.headers.get("Content-Length") || 0) > maxBytes) {
    throw new ApiError(413, "too_large");
  }
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) throw new Error("not object");
    return body;
  } catch {
    throw new ApiError(400, "invalid_json");
  }
}

function cleanString(value, maxChars) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxChars);
}

// For values rendered inside a markdown table cell: no newlines or pipes.
function cleanLine(value, maxChars) {
  return cleanString(value, maxChars).replace(/[\r\n|]+/g, " ");
}

// --- feedback ---

async function handleFeedback(request, env, cors) {
  rateLimit("fb", clientIp(request), RATE_LIMITS.feedback);
  const body = await readJson(request, 64_000);

  // Honeypot: real UI never fills this field. Pretend success for bots.
  if (body.website) return json({ ok: true }, 200, cors);

  const type = Object.prototype.hasOwnProperty.call(TYPE_LABELS, body.type) ? body.type : "other";
  const message = cleanString(body.message, MAX_MESSAGE_CHARS);
  if (!message) throw new ApiError(400, "empty_message");
  const contact = cleanLine(body.contact, MAX_CONTACT_CHARS);
  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
  const version = cleanLine(meta.version, MAX_META_CHARS);
  const lang = cleanLine(meta.lang, MAX_META_CHARS);
  const ua = cleanLine(meta.ua, MAX_META_CHARS);
  const screen = cleanLine(meta.screen, MAX_META_CHARS);

  const firstLine = message.split("\n", 1)[0];
  const title = `[${type}] ${firstLine.slice(0, 60)}${firstLine.length > 60 ? "..." : ""}`;
  const issueBody = [
    message,
    "",
    "---",
    `| field | value |`,
    `| --- | --- |`,
    `| type | ${type} |`,
    `| contact | ${contact || "(none)"} |`,
    `| app version | ${version || "?"} |`,
    `| language | ${lang || "?"} |`,
    `| screen | ${screen || "?"} |`,
    `| user agent | ${ua || "?"} |`,
  ].join("\n");

  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "training-tracker-feedback-worker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body: issueBody, labels: [TYPE_LABELS[type]] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error("github issue create failed", res.status, (await res.text()).slice(0, 500));
    throw new ApiError(502, "github_error");
  }
  return json({ ok: true }, 200, cors);
}

// --- backup ---

async function handleBackupWrite(request, env, cors) {
  rateLimit("bk", clientIp(request), RATE_LIMITS.backup);
  const body = await readJson(request, MAX_BLOB_CHARS + 64_000);

  const slot = normalizeSlot(body.slot);
  // The blob is opaque ciphertext; the server validates only type and size.
  if (typeof body.blob !== "string" || body.blob.length === 0) throw new ApiError(400, "invalid_blob");
  if (body.blob.length > MAX_BLOB_CHARS) throw new ApiError(413, "too_large");

  const updatedAt = new Date().toISOString();
  await env.STORE.put(slotKey(slot), JSON.stringify({ updatedAt, blob: body.blob }), {
    expirationTtl: SLOT_TTL_SECONDS,
  });
  return json({ ok: true, updatedAt }, 200, cors);
}

async function handleBackupRead(url, request, env, cors) {
  rateLimit("bk", clientIp(request), RATE_LIMITS.backup);
  const slot = normalizeSlot(url.searchParams.get("slot"));
  const raw = await env.STORE.get(slotKey(slot));
  if (raw === null) throw new ApiError(404, "unknown_slot");
  const stored = JSON.parse(raw);
  return json({ ok: true, updatedAt: stored.updatedAt, blob: stored.blob }, 200, cors);
}

async function handleBackupDelete(url, request, env, cors) {
  rateLimit("bk", clientIp(request), RATE_LIMITS.backup);
  const slot = normalizeSlot(url.searchParams.get("slot"));
  await env.STORE.delete(slotKey(slot));
  return json({ ok: true }, 200, cors);
}

function slotKey(slot) {
  return `bk:${slot}`;
}

function normalizeSlot(value) {
  const slot = String(value || "").trim().toLowerCase();
  if (!SLOT_RE.test(slot)) throw new ApiError(400, "invalid_slot");
  return slot;
}

// --- push scheduling ---

async function handlePushSchedule(request, env, cors) {
  rateLimit("ps", clientIp(request), RATE_LIMITS.push);
  const body = await readJson(request, 16_000);

  const subscription = normalizeSubscription(body.subscription);
  const fireAtMs = Number(body.fireAtMs);
  const now = Date.now();
  if (!Number.isFinite(fireAtMs) || fireAtMs < now - PUSH_PAST_GRACE_MS || fireAtMs > now + PUSH_MAX_DELAY_MS) {
    throw new ApiError(400, "invalid_fire_at");
  }
  const title = cleanLine(body.title, PUSH_TITLE_MAX);
  const text = cleanLine(body.body, PUSH_BODY_MAX);
  if (!title || !text) throw new ApiError(400, "empty_notification");

  const stub = pushStub(env, subscription.endpoint);
  await stub.fetch("https://do/schedule", {
    method: "POST",
    body: JSON.stringify({ action: "schedule", job: { subscription, fireAtMs, title, body: text } }),
  });
  return json({ ok: true }, 200, cors);
}

async function handlePushCancel(request, env, cors) {
  rateLimit("ps", clientIp(request), RATE_LIMITS.push);
  const body = await readJson(request, 8_000);

  const subscription = normalizeSubscription(body.subscription);
  const stub = pushStub(env, subscription.endpoint);
  await stub.fetch("https://do/cancel", {
    method: "POST",
    body: JSON.stringify({ action: "cancel" }),
  });
  return json({ ok: true }, 200, cors);
}

function pushStub(env, endpoint) {
  return env.PUSH_DO.get(env.PUSH_DO.idFromName(endpoint));
}

function normalizeSubscription(value) {
  if (typeof value !== "object" || value === null) throw new ApiError(400, "invalid_subscription");
  const endpoint = typeof value.endpoint === "string" ? value.endpoint.trim() : "";
  if (!endpoint || endpoint.length > PUSH_ENDPOINT_MAX) throw new ApiError(400, "invalid_subscription");

  let host;
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:") throw new Error("not https");
    host = parsed.hostname.toLowerCase();
  } catch {
    throw new ApiError(400, "invalid_subscription");
  }
  const allowed = PUSH_HOST_ALLOW.some((rule) =>
    rule.exact ? host === rule.exact : host.endsWith(rule.suffix)
  );
  if (!allowed) throw new ApiError(400, "unsupported_push_service");

  const keys = value.keys && typeof value.keys === "object" ? value.keys : {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!p256dh || !auth || p256dh.length > PUSH_KEY_MAX || auth.length > PUSH_KEY_MAX) {
    throw new ApiError(400, "invalid_subscription");
  }
  return { endpoint, keys: { p256dh, auth } };
}

// One instance per subscription endpoint (idFromName). Holds at most one
// pending job; schedule overwrites, cancel clears, the alarm delivers.
export class PushScheduler {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const { action, job } = await request.json();
    if (action === "schedule") {
      await this.ctx.storage.put("job", job);
      await this.ctx.storage.setAlarm(job.fireAtMs);
    } else if (action === "cancel") {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async alarm() {
    const job = await this.ctx.storage.get("job");
    if (!job) return;
    // A job this stale is a leftover from exhausted retries (or a clock
    // anomaly); the notification stopped being useful long ago, so drop it
    // instead of delivering it or keeping the row forever.
    if (Date.now() - job.fireAtMs > 3_600_000) {
      await this.ctx.storage.deleteAll();
      return;
    }

    let built;
    try {
      built = await buildPushHTTPRequest({
        privateJWK: this.env.VAPID_PRIVATE_JWK,
        subscription: job.subscription,
        message: {
          payload: { title: job.title, body: job.body },
          adminContact: PUSH_ADMIN_CONTACT,
          // A rest-end notice is worthless once the next set is well
          // underway; let the push service drop it after 10 minutes.
          options: { ttl: 600, urgency: "high" },
        },
      });
    } catch (err) {
      // Encryption/signing failed: retrying cannot fix a bad subscription.
      console.error("push build failed", err && err.message);
      await this.ctx.storage.deleteAll();
      return;
    }

    const res = await fetch(built.endpoint, {
      method: "POST",
      headers: built.headers,
      body: built.body,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok || res.status === 400 || res.status === 403 || res.status === 404 || res.status === 410) {
      // Delivered, or the subscription is expired/invalid; either way the
      // job is finished. The client re-subscribes on its next toggle/boot.
      if (!res.ok) console.error("push rejected", res.status);
      await this.ctx.storage.deleteAll();
      return;
    }
    // Transient failure (429/5xx): throw so the platform retries the alarm
    // with backoff; the stored job stays for the retry to pick up.
    throw new Error(`push send failed: ${res.status}`);
  }
}
