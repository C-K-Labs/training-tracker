// Form-cue tips (v1.5.0). One line per exercise: the key setup number
// (bench angle, pad position, grip width) plus where the effort should be
// felt. Content lives in the i18n dictionaries as extip.<catalog-key> so the
// parity test guarantees all six languages.
//
// Resolution covers the three id shapes in the wild:
//   - generator-created records carry i18nKey ("exname.<key>")
//   - seeded records use the catalog key as their id
//   - imported program-pack ids either match the catalog key or map here
// User-created exercises match none of these and simply get no tip.

import { t } from "./i18n.js";

// Exported for js/seed.js, whose i18nKey backfill uses the same id mapping.
export const ALIASES = {
  "db-ohp": "overhead-press",
  "lat-pulldown-close": "lat-pulldown",
  "pushup-home": "pushup",
  "bench-press": "smith-bench",
  "seated-row": "seated-cable-row",
};

// Returns the localized tip string, or null when this exercise has none.
export function tipFor(exercise) {
  if (!exercise) return null;
  let key;
  if (typeof exercise.i18nKey === "string" && exercise.i18nKey.startsWith("exname.")) {
    key = exercise.i18nKey.slice("exname.".length);
  } else {
    key = ALIASES[exercise.id] || exercise.id;
  }
  const tipKey = `extip.${key}`;
  const text = t(tipKey);
  // t() falls back to the key itself for unknown keys; that means "no tip".
  return text === tipKey ? null : text;
}
