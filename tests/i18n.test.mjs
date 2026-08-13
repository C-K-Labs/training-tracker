// Permanent parity guard for the i18n dictionaries. A key added to one
// language and forgotten in another silently falls back to Korean at runtime,
// which reads as a bug to every non-Korean user; this test makes the omission
// fail loudly instead, naming the exact keys.

import { test } from "node:test";
import assert from "node:assert/strict";

import { dictionaries } from "../js/i18n.js";
import { CHANGELOG } from "../js/version.js";
import { CATALOG } from "../js/gen.js";

const LANGS = Object.keys(dictionaries);
const REFERENCE = "ko";

function diff(a, b) {
  return a.filter((k) => !b.includes(k)).sort();
}

test("every language dictionary is present", () => {
  assert.deepEqual(LANGS.sort(), ["en", "es", "ja", "ko", "pt", "zh"]);
});

test("all dictionaries have identical key sets", () => {
  const refKeys = Object.keys(dictionaries[REFERENCE]);
  const problems = [];

  for (const lang of LANGS) {
    if (lang === REFERENCE) continue;
    const keys = Object.keys(dictionaries[lang]);
    const missing = diff(refKeys, keys);
    const extra = diff(keys, refKeys);
    if (missing.length) problems.push(`${lang} is missing: ${missing.join(", ")}`);
    if (extra.length) problems.push(`${lang} has extra keys not in ${REFERENCE}: ${extra.join(", ")}`);
  }

  assert.equal(problems.length, 0, `dictionary key sets diverge\n${problems.join("\n")}`);
});

test("no dictionary has duplicate or empty values for a key", () => {
  const empties = [];
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(dictionaries[lang])) {
      if (typeof value !== "string" || value.trim() === "") empties.push(`${lang}:${key}`);
    }
  }
  assert.equal(empties.length, 0, `empty or non-string values: ${empties.join(", ")}`);
});

// Patch notes are user-facing i18n content too: a release note added in one
// language and forgotten in another would silently fall back to English, so
// hold CHANGELOG to the same parity bar as the dictionaries.
test("every changelog entry has notes in every language", () => {
  const problems = [];
  for (const entry of CHANGELOG) {
    for (const lang of LANGS) {
      const notes = entry.notes[lang];
      if (!Array.isArray(notes) || notes.length === 0) {
        problems.push(`v${entry.version} has no ${lang} notes`);
        continue;
      }
      if (notes.some((n) => typeof n !== "string" || n.trim() === "")) {
        problems.push(`v${entry.version} has an empty ${lang} note`);
      }
    }
    const extra = diff(Object.keys(entry.notes), LANGS);
    if (extra.length) problems.push(`v${entry.version} has unknown languages: ${extra.join(", ")}`);
  }
  assert.equal(problems.length, 0, `changelog language coverage diverges\n${problems.join("\n")}`);
});

// Catalog <-> dictionary sync (v1.5.0): every catalog exercise must ship a
// localized name AND a form-cue tip in the reference language. The parity
// test above then extends the guarantee to the other five languages.
test("every catalog exercise has an exname and an extip in the reference language", () => {
  const missing = [];
  for (const [key, ex] of Object.entries(CATALOG)) {
    if (!(ex.i18nKey in dictionaries[REFERENCE])) missing.push(ex.i18nKey);
    if (!(`extip.${key}` in dictionaries[REFERENCE])) missing.push(`extip.${key}`);
  }
  assert.equal(missing.length, 0, `catalog keys without dictionary entries: ${missing.join(", ")}`);
});

test("the v1.3.0 feedback keys exist in every language", () => {
  const feedbackKeys = Object.keys(dictionaries[REFERENCE])
    .filter((k) => k.startsWith("settings.feedback."));
  assert.ok(feedbackKeys.length > 0, "the ko dictionary has no settings.feedback.* keys");

  for (const lang of LANGS) {
    const missing = feedbackKeys.filter((k) => !(k in dictionaries[lang]));
    assert.equal(missing.length, 0, `${lang} is missing feedback keys: ${missing.join(", ")}`);
  }
});
