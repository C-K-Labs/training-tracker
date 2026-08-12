// Rest-end push: only the pure helper is covered here. Everything else in
// js/push.js is browser-API glue (Notification, PushManager, fetch) that a
// Node test could only assert against its own stubs.
import test from "node:test";
import assert from "node:assert/strict";
import { urlBase64ToUint8Array } from "../js/push.js";

// The VAPID key the app ships with: 65 raw bytes, uncompressed P-256 point,
// so it must start with 0x04. A decoder that mishandles base64url padding or
// the -/_ alphabet produces the wrong length here, which is exactly the bug
// that makes pushManager.subscribe reject at runtime.
const VAPID_PUBLIC_KEY = "BBdNREH8cNjbol6DjUmieIPb_PjemZu55Xt-BU1HxRptSsleXv7iqFUzvCzFjCShC0Vtf33dfpNATPGxTWyKaWQ";

test("urlBase64ToUint8Array: the VAPID key decodes to a 65-byte P-256 point", () => {
  const bytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 0x04);
});

test("urlBase64ToUint8Array: base64url alphabet and missing padding both decode", () => {
  // "ab~c" -> standard base64 "YWJ+Yw==", base64url "YWJ-Yw" (no padding).
  assert.deepEqual([...urlBase64ToUint8Array("YWJ-Yw")], [0x61, 0x62, 0x7e, 0x63]);
  // 0xfb 0xff 0xbf encodes to "+/+/" in standard base64, "-_-_" in base64url.
  assert.deepEqual([...urlBase64ToUint8Array("-_-_")], [0xfb, 0xff, 0xbf]);
  assert.deepEqual([...urlBase64ToUint8Array("")], []);
});
