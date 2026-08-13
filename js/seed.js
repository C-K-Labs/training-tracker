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

// Bump when the shipped catalog grows so syncLibrary runs once per upgrade.
// v1: the original 10-exercise inline seed. v2: the 46-exercise catalog.
export const LIBRARY_VERSION = 2;

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

// One-shot merge for installs that seeded an older (smaller) library: adds
// only exercises whose id is absent, never touches existing records or their
// history. The kv marker makes this run once per LIBRARY_VERSION bump, so an
// exercise the user deliberately deleted afterward stays deleted.
export async function syncLibrary() {
  const marker = await get("kv", "libraryVersion");
  if (marker && marker.v >= LIBRARY_VERSION) return false;
  const have = new Set((await getAll("exercises")).map((e) => e.id));
  const missing = DEFAULT_EXERCISES.filter((e) => !have.has(e.id));
  if (missing.length > 0) await bulkPut("exercises", missing);
  await put("kv", { key: "libraryVersion", v: LIBRARY_VERSION });
  return missing.length > 0;
}
