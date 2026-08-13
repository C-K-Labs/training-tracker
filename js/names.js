// Display-name localization (v1.6.0). Two rules, both display-time only
// (stored data never changes):
//
//  - Exercises: records that carry a shipped-catalog pointer (i18nKey, set on
//    seeded and generator-created exercises, backfilled by js/seed.js when a
//    record still holds the untouched default name) render in the current UI
//    language. Personal program-pack exercises carry no pointer and render
//    exactly as the user named them.
//  - Programs: generator-created program names ship as fixed Korean literals
//    ("전신 A", "상체 B", ...). Names matching that closed set (including the
//    per-session programName snapshots taken at session start) localize; any
//    other name is user text and renders as-is.

import { t } from "./i18n.js";

export function exName(exercise) {
  if (!exercise) return "";
  const key = exercise.i18nKey;
  if (typeof key === "string" && key.startsWith("exname.")) {
    const s = t(key);
    if (s !== key) return s;
  }
  return exercise.name;
}

const GEN_PROGRAM_RE = /^(전신|상체|하체|푸시|풀|레그)( [A-C])?$/;
const GEN_PROGRAM_KEY = {
  "전신": "program.full",
  "상체": "program.upper",
  "하체": "program.lower",
  "푸시": "program.push",
  "풀": "program.pull",
  "레그": "program.legs",
};

export function programLabel(name) {
  const m = GEN_PROGRAM_RE.exec(String(name || ""));
  if (!m) return name || "";
  return m[2] ? `${t(GEN_PROGRAM_KEY[m[1]])}${m[2]}` : t(GEN_PROGRAM_KEY[m[1]]);
}
