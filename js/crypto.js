// Client-side crypto for cloud backup (v1.3.0). End-to-end model: the sync
// code is generated on the device and never sent anywhere. PBKDF2 stretches
// it into 384 bits, split into an AES-GCM 256-bit key and a 128-bit storage
// slot id; only the slot id and ciphertext reach the server, so the server
// cannot read a backup and brute-forcing either half costs the full KDF work
// per guess. Losing the code therefore loses the backup, by design.

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
const CODE_CHARS = 12; // ~59.5 bits of entropy
const KDF_ITERATIONS = 310_000;
const KDF_SALT = "training-tracker-cloud-backup-v1";
const BLOB_VERSION = 1;

// XXXX-XXXX-XXXX, unbiased via rejection sampling (248 = 8 * 31).
export function generateCode() {
  const chars = [];
  while (chars.length < CODE_CHARS) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      if (b < 248 && chars.length < CODE_CHARS) chars.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}

// Accepts user input with any case, spacing, or dash placement; returns the
// canonical XXXX-XXXX-XXXX form, or null when it is not a valid code.
export function normalizeCode(text) {
  const bare = String(text || "").toUpperCase().replace(/[\s-]+/g, "");
  if (bare.length !== CODE_CHARS) return null;
  for (const ch of bare) if (!CODE_ALPHABET.includes(ch)) return null;
  return `${bare.slice(0, 4)}-${bare.slice(4, 8)}-${bare.slice(8)}`;
}

// PBKDF2 -> 384 bits: first 256 = AES-GCM key, last 128 = slot id (hex).
export async function deriveFromCode(code) {
  const canonical = normalizeCode(code);
  if (!canonical) throw new Error("invalid-code");
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(canonical), "PBKDF2", false, ["deriveBits"],
  );
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(KDF_SALT), iterations: KDF_ITERATIONS },
    material, 384,
  ));
  const key = await crypto.subtle.importKey(
    "raw", bits.slice(0, 32), { name: "AES-GCM" }, false, ["encrypt", "decrypt"],
  );
  const slotId = [...bits.slice(32)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { key, slotId };
}

export async function encryptPack(pack, code) {
  const { key, slotId } = await deriveFromCode(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(pack)),
  );
  const blob = JSON.stringify({ v: BLOB_VERSION, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) });
  return { slotId, blob };
}

// Throws on a wrong code, tampered ciphertext, or malformed blob; AES-GCM
// authentication covers the first two, JSON/base64 parsing the last.
export async function decryptBlob(blob, code) {
  const parsed = JSON.parse(blob);
  if (parsed.v !== BLOB_VERSION) throw new Error("unsupported-version");
  const { key } = await deriveFromCode(code);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(parsed.iv) }, key, fromBase64(parsed.ct),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

function toBase64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text) {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
