// Cloudflare Worker backing the Training Tracker PWA.
//
// Endpoints:
//   POST   /feedback        -> creates an issue in the private feedback repo
//   POST   /backup          -> stores an opaque encrypted blob under a slot id
//   GET    /backup?slot=X   -> returns the blob stored under the slot
//   DELETE /backup?slot=X   -> removes the slot
//
// Bindings: STORE (KV). Vars: GITHUB_REPO, ALLOWED_ORIGINS. Secret: GITHUB_TOKEN.
// End-to-end encryption model: the app derives both the 128-bit slot id and an
// AES-GCM key from the user's sync code via PBKDF2 (js/crypto.js in the app).
// This server only ever sees the slot id and ciphertext; it cannot read a
// backup. The slot id is the only credential, so slot paths are rate limited
// per client IP. Slots expire 180 days after the last write (refreshed on
// every backup), which both bounds storage abuse and acts as the stated
// retention policy.

const SLOT_RE = /^[0-9a-f]{32}$/;
const SLOT_TTL_SECONDS = 15_552_000; // 180 days
const MAX_BLOB_CHARS = 1_400_000; // ~1MB plaintext after base64 + JSON overhead
const MAX_MESSAGE_CHARS = 5000;
const MAX_CONTACT_CHARS = 200;
const MAX_META_CHARS = 300;
const RATE_LIMITS = { feedback: 5, backup: 20 };
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
