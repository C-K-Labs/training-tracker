// Cloud-backup crypto: code generation, normalization, derivation, and the
// encrypt/decrypt roundtrip including failure modes. Runs on Node's WebCrypto.
import test from "node:test";
import assert from "node:assert/strict";
import { generateCode, normalizeCode, deriveFromCode, encryptPack, decryptBlob } from "../js/crypto.js";

const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

test("generateCode: canonical format, excluded chars never appear, codes differ", () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    assert.match(code, CODE_RE);
    for (const banned of "ILO01") assert.ok(!code.includes(banned), `${code} contains ${banned}`);
    seen.add(code);
  }
  assert.equal(seen.size, 50);
});

test("normalizeCode: case, spacing, and dash placement are forgiven; junk is rejected", () => {
  assert.equal(normalizeCode("abcd-efgh-jkmn"), "ABCD-EFGH-JKMN");
  assert.equal(normalizeCode("ABCD EFGH JKMN"), "ABCD-EFGH-JKMN");
  assert.equal(normalizeCode("  abcdefghjkmn  "), "ABCD-EFGH-JKMN");
  assert.equal(normalizeCode("ab-cdef-ghjk-mn"), "ABCD-EFGH-JKMN");
  assert.equal(normalizeCode("ABCD-EFGH-JKM"), null); // too short
  assert.equal(normalizeCode("ABCD-EFGH-JKMNP"), null); // too long
  assert.equal(normalizeCode("ABCD-EFGH-JKM0"), null); // 0 not in alphabet
  assert.equal(normalizeCode(""), null);
  assert.equal(normalizeCode(null), null);
});

test("deriveFromCode: deterministic 32-hex slot id, equivalent inputs agree, codes diverge", async () => {
  const a = await deriveFromCode("ABCD-EFGH-JKMN");
  const b = await deriveFromCode("abcd efgh jkmn");
  const c = await deriveFromCode("ABCD-EFGH-JKMP");
  assert.match(a.slotId, /^[0-9a-f]{32}$/);
  assert.equal(a.slotId, b.slotId);
  assert.notEqual(a.slotId, c.slotId);
});

test("encryptPack/decryptBlob: roundtrip preserves the pack, iv varies per call", async () => {
  const code = generateCode();
  const pack = { formatVersion: 3, exercises: [{ id: "x", name: "스쿼트" }], sessions: [] };
  const one = await encryptPack(pack, code);
  const two = await encryptPack(pack, code);
  assert.match(one.slotId, /^[0-9a-f]{32}$/);
  assert.equal(one.slotId, two.slotId);
  assert.notEqual(one.blob, two.blob); // fresh iv every time
  assert.deepEqual(await decryptBlob(one.blob, code), pack);
  assert.deepEqual(await decryptBlob(two.blob, code), pack);
});

test("decryptBlob: wrong code and tampered ciphertext both reject", async () => {
  const { blob } = await encryptPack({ a: 1 }, "ABCD-EFGH-JKMN");
  await assert.rejects(() => decryptBlob(blob, "ABCD-EFGH-JKMP"));
  const parsed = JSON.parse(blob);
  const bytes = Uint8Array.from(atob(parsed.ct), (ch) => ch.charCodeAt(0));
  bytes[0] ^= 0xff;
  parsed.ct = btoa(String.fromCharCode(...bytes));
  await assert.rejects(() => decryptBlob(JSON.stringify(parsed), "ABCD-EFGH-JKMN"));
});

test("decryptBlob: malformed blob and unsupported version reject", async () => {
  await assert.rejects(() => decryptBlob("not json", "ABCD-EFGH-JKMN"));
  await assert.rejects(() => decryptBlob(JSON.stringify({ v: 99, iv: "", ct: "" }), "ABCD-EFGH-JKMN"));
});
