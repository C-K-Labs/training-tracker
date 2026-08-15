// Default exercise library. Seeded whole on first run, and merged into
// existing installs whenever LIBRARY_VERSION bumps (syncLibrary below). The
// app ships with no personal data; the owner's real program and history
// arrive via a program pack import (Settings > Data).
//
// v1.5.0: derived from the generator catalog (js/gen.js CATALOG) so the
// library and the course generator share one source of truth. Record ids are
// the catalog keys, which is also what the tip resolver (js/tips.js) and the
// imported program packs key on.

import { getAll, bulkPut, get, put } from "./store.js";
import { CATALOG, loadConventionFor } from "./gen.js";
import { ALIASES } from "./tips.js";

// Bump when the shipped catalog grows so syncLibrary runs once per upgrade.
// v1: the original 10-exercise inline seed. v2: the 46-exercise catalog.
// v3: i18nKey backfill so pre-v1.5 records localize (see syncLibrary).
// v4: calisthenics skill work (planche/lever/muscle-up/handstand movements).
export const LIBRARY_VERSION = 4;

export const DEFAULT_EXERCISES = Object.entries(CATALOG).map(([key, ex]) => ({
  id: key,
  name: ex.nameKo,
  bodyPart: ex.bodyPart,
  equipment: ex.equipment,
  unit: "lb",
  loadConvention: loadConventionFor(ex.equipment),
  variant: "",
  spinalLoad: !!ex.spinalLoad,
  emphasis: "",
  i18nKey: ex.i18nKey,
}));

export async function seedIfEmpty() {
  const existing = await getAll("exercises");
  if (existing.length === 0) {
    await bulkPut("exercises", DEFAULT_EXERCISES);
    await put("kv", { key: "libraryVersion", v: LIBRARY_VERSION });
    return true;
  }
  return false;
}

// One-shot upgrade for installs that seeded an older library. Two moves, both
// gated by the kv marker so they run once per LIBRARY_VERSION bump:
//  - add exercises whose id is absent (never touches existing records or
//    their history; an exercise the user deliberately deleted stays deleted)
//  - backfill i18nKey onto records created before v1.5 shipped it, but ONLY
//    when the record still holds the untouched shipped Korean name. A record
//    the user renamed, and any personal program-pack exercise whose name
//    differs from the catalog default, is personal data and stays literal.
export async function syncLibrary() {
  const marker = await get("kv", "libraryVersion");
  if (marker && marker.v >= LIBRARY_VERSION) return false;
  const existing = await getAll("exercises");

  const have = new Set(existing.map((e) => e.id));
  const missing = DEFAULT_EXERCISES.filter((e) => !have.has(e.id));
  if (missing.length > 0) await bulkPut("exercises", missing);

  const backfill = [];
  for (const ex of existing) {
    if (typeof ex.i18nKey === "string" && ex.i18nKey.startsWith("exname.")) continue;
    const catalogKey = CATALOG[ex.id] ? ex.id : ALIASES[ex.id];
    const entry = catalogKey ? CATALOG[catalogKey] : null;
    if (entry && ex.name === entry.nameKo) {
      backfill.push({ ...ex, i18nKey: entry.i18nKey });
    }
  }
  if (backfill.length > 0) await bulkPut("exercises", backfill);

  await put("kv", { key: "libraryVersion", v: LIBRARY_VERSION });
  return missing.length > 0 || backfill.length > 0;
}

// -------------------------------------------------- i18nKey backfill (v1.8.0)
//
// The one-shot syncLibrary backfill above misses two real paths:
//  - a fresh install seeds the catalog (marker written), THEN a personal
//    pack import overwrites those records with i18nKey-less copies, and the
//    marker keeps the backfill from ever running again
//  - pack records whose Korean names differ from the catalog only by
//    spacing, or that name a variant the catalog does not carry at all
// So this runs on EVERY boot: it is idempotent (records that already carry
// a key are skipped) and cheap (one getAll over ~50 records). The guard
// stays conservative: a key is attached only when the record's name matches
// the known Korean default (ignoring spaces); anything the user renamed is
// personal data and stays literal.

// Known pack exercises the shipped catalog cannot cover: variant names that
// must keep their meaning (Smith bench, DB OHP, plain cable row) and the
// calisthenics holds. Each maps an id to its expected pack name and a
// dedicated exname.* dictionary key shipped in all six languages.
const PACK_SUPPLEMENT = {
  "standing-cable-row": { name: "케이블로우", i18nKey: "exname.cable-row" },
  "smith-bench": { name: "스미스 벤치프레스", i18nKey: "exname.smith-bench-press" },
  "db-ohp": { name: "덤벨 오버헤드프레스", i18nKey: "exname.db-overhead-press" },
  "planche-lean": { name: "플란치 린", i18nKey: "exname.planche-lean" },
  "tuck-planche": { name: "턱 플란치", i18nKey: "exname.tuck-planche" },
  "l-sit": { name: "L싯", i18nKey: "exname.l-sit" },
};

const normName = (s) => String(s || "").replace(/\s+/g, "");

export async function backfillI18nKeys() {
  const existing = await getAll("exercises");
  const patch = [];
  for (const ex of existing) {
    if (typeof ex.i18nKey === "string" && ex.i18nKey.startsWith("exname.")) continue;
    const catalogKey = CATALOG[ex.id] ? ex.id : ALIASES[ex.id];
    const entry = catalogKey ? CATALOG[catalogKey] : null;
    if (entry && normName(ex.name) === normName(entry.nameKo)) {
      patch.push({ ...ex, i18nKey: entry.i18nKey });
      continue;
    }
    const sup = PACK_SUPPLEMENT[ex.id];
    if (sup && normName(ex.name) === normName(sup.name)) {
      patch.push({ ...ex, i18nKey: sup.i18nKey });
    }
  }
  if (patch.length > 0) await bulkPut("exercises", patch);
  return patch.length;
}
