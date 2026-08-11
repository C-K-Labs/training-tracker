// Permanent parity guard for the i18n dictionaries. A key added to one
// language and forgotten in another silently falls back to Korean at runtime,
// which reads as a bug to every non-Korean user; this test makes the omission
// fail loudly instead, naming the exact keys.

import { test } from "node:test";
import assert from "node:assert/strict";

import { dictionaries } from "../js/i18n.js";

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

test("the v1.3.0 feedback keys exist in every language", () => {
  const feedbackKeys = Object.keys(dictionaries[REFERENCE])
    .filter((k) => k.startsWith("settings.feedback."));
  assert.ok(feedbackKeys.length > 0, "the ko dictionary has no settings.feedback.* keys");

  for (const lang of LANGS) {
    const missing = feedbackKeys.filter((k) => !(k in dictionaries[lang]));
    assert.equal(missing.length, 0, `${lang} is missing feedback keys: ${missing.join(", ")}`);
  }
});
