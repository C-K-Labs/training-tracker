// Rest-end push notifications (v1.4). The rest bar already counts down on the
// device, but a phone in a pocket with the screen off shows nothing: Web Push
// fixes that by having a server deliver one notification at the exact moment
// rest ends, which the phone renders on the lock screen and mirrors to a
// paired watch. Only the push subscription, the fire time, and the short
// next-set line ever leave the device; no training data is sent.
//
// Every function here is fire-and-forget. A dead network, a rejected
// permission, or a 500 from the server must never disturb the rest bar, so
// failures are swallowed (console.warn at most) and the local countdown,
// beep, and vibration keep working exactly as before.

import { getSettings } from "./store.js";

const PUSH_ENDPOINT = "https://training-tracker-api.ck-labs.workers.dev/push";

// Identifies this app to the browser's push service. Public by design: it is
// handed to every client inside the subscribe() call. The matching private
// key exists only in the Worker's environment and is never in this repo.
// Rotated 2026-08-12 (v1.6.0): the original private secret was stored
// corrupted, so every push failed server-side; subscriptions made under the
// old key are migrated by ensureFreshSubscription below.
const VAPID_PUBLIC_KEY = "BD5Km_LN9Lj_s4Dx_T1ppYnwgv_hTr5NI7QZf1lMpnkird2U3oL53bJaez125a8axcwl11MC_hH9UHtuTR4jumE";

// One pending notification per device is kept server-side, keyed by the
// subscription, so a new schedule replaces the previous one and the client
// needs no id bookkeeping.
let cachedSubscription = null;

// PushManager.subscribe wants raw key bytes; VAPID keys travel as base64url
// (- and _ instead of + and /, padding stripped).
export function urlBase64ToUint8Array(base64url) {
  const base64 = String(base64url).replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function isSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator
    && typeof window !== "undefined" && "PushManager" in window && "Notification" in window;
}

// "granted" | "denied" | "default" | "unsupported": what the settings row
// renders without having to touch the Notification API itself.
export function permissionState() {
  if (!isSupported()) return "unsupported";
  return Notification.permission;
}

// iOS ships Web Push only to home-screen installs, so a Safari tab on an
// iPhone reports unsupported and needs the install hint instead of a toggle.
// Same detection as the install banner in js/app.js (iPadOS 13+ reports a
// Mac user agent, so a touch-capable "Mac" counts as iOS).
export function iosNeedsInstall() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  const standalone = (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches)
    || navigator.standalone === true;
  return !standalone;
}

// Requests are chained (v1.6.0): logging a set fires cancel-then-schedule
// back to back, and both address the same server-side scheduler object. Two
// concurrent fetches can arrive reordered, letting the stale cancel delete
// the fresh job; serializing through one promise chain preserves call order.
let postChain = Promise.resolve();

function postJson(path, body) {
  postChain = postChain.then(async () => {
    try {
      const res = await fetch(`${PUSH_ENDPOINT}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) console.warn(`push ${path} rejected`, res.status);
    } catch {
      // Offline gym, blocked request, server down: the local rest bar is the
      // real timer, the push is a convenience on top of it.
    }
  });
  return postChain;
}

// A subscription made under a previous VAPID key is useless: the server now
// signs with the rotated key and the push service rejects the mismatch. When
// permission is already granted, silently replace it (subscribe() needs no
// user gesture once granted); otherwise drop it so the toggle re-prompts.
function keyMatches(sub) {
  const current = sub.options && sub.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function ensureFreshSubscription(reg, sub) {
  if (!sub || keyMatches(sub)) return sub;
  try {
    await sub.unsubscribe();
  } catch {
    // Push service already dropped it; subscribing again is what matters.
  }
  if (Notification.permission !== "granted") return null;
  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch {
    return null;
  }
}

// The subscription lookup goes through the service worker registration, so it
// is cached: startRest runs on every logged set and must stay cheap.
async function currentSubscription() {
  if (cachedSubscription) return cachedSubscription;
  if (!isSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    cachedSubscription = await ensureFreshSubscription(reg, sub);
    return cachedSubscription;
  } catch {
    return null;
  }
}

// Scheduling is inert unless the user turned the feature on AND the browser
// still grants permission AND a subscription exists; any missing piece means
// the app behaves exactly as it did before this feature existed.
async function activeSubscription() {
  if (!isSupported() || Notification.permission !== "granted") return null;
  try {
    const settings = await getSettings();
    if (settings.restPushEnabled !== true) return null;
  } catch {
    return null;
  }
  return currentSubscription();
}

// Must be called straight from the toggle's click handler: iOS only shows the
// permission prompt while the user gesture is still active, so nothing may be
// awaited before requestPermission(). Returns "granted" | "denied" |
// "default" (prompt dismissed) | "unsupported" | "error".
export async function enableRestPush() {
  if (!isSupported()) return "unsupported";

  let permission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return "error";
  }
  if (permission !== "granted") return permission === "denied" ? "denied" : "default";

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await ensureFreshSubscription(reg, await reg.pushManager.getSubscription());
    cachedSubscription = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return "granted";
  } catch (err) {
    console.warn("push subscribe failed", err);
    return "error";
  }
}

// Cancel first, then unsubscribe: the server is addressed by the subscription
// endpoint, which stops being valid the moment the subscription is dropped.
export async function disableRestPush() {
  const sub = await currentSubscription();
  cachedSubscription = null;
  if (!sub) return;
  await postJson("/cancel", { subscription: sub.toJSON() });
  try {
    await sub.unsubscribe();
  } catch {
    // Already gone, or the push service refused: nothing left to clean up
    // on this device either way.
  }
}

export async function scheduleRestPush(fireAtMs, title, body) {
  if (!Number.isFinite(fireAtMs)) return;
  const sub = await activeSubscription();
  if (!sub) return;
  await postJson("/schedule", {
    subscription: sub.toJSON(),
    fireAtMs: Math.round(fireAtMs),
    title: String(title == null ? "" : title),
    body: String(body == null ? "" : body),
  });
}

export async function cancelRestPush() {
  const sub = await activeSubscription();
  if (!sub) return;
  await postJson("/cancel", { subscription: sub.toJSON() });
}
