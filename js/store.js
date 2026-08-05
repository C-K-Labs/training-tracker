// IndexedDB persistence layer: thin promise wrapper, schema, settings,
// and the program-pack export/import (the same JSON shape both ways).
// All personal data lives here on the device; the repo ships nothing personal.

const DB_NAME = "training-tracker";
const DB_VERSION = 2;
export const PACK_FORMAT_VERSION = 1;

let db = null;

export function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("exercises")) d.createObjectStore("exercises", { keyPath: "id" });
      if (!d.objectStoreNames.contains("programs")) d.createObjectStore("programs", { keyPath: "id" });
      if (!d.objectStoreNames.contains("sessions")) {
        const s = d.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("date", "date");
      }
      if (!d.objectStoreNames.contains("bodyweight")) d.createObjectStore("bodyweight", { keyPath: "date" });
      if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv", { keyPath: "key" });
      // v2 (B2): daily water intake, one record per calendar date.
      if (!d.objectStoreNames.contains("water")) d.createObjectStore("water", { keyPath: "date" });
    };
    req.onsuccess = () => {
      db = req.result;
      // One-time, idempotent post-open migration (v1 -> v2): existing "run"
      // sessions become "cardio" sessions. Guarded by a kv flag so it never
      // re-runs after it has completed once; also naturally idempotent since
      // migrated sessions no longer have kind "run".
      migrateToV2()
        .catch((err) => { console.error("v2 migration failed", err); })
        .then(() => resolve(db));
    };
    req.onerror = () => reject(req.error);
  });
}

// Converts a legacy run session into a cardio session in place, keeping the
// old `run` field untouched on the object so no data is lost.
function runSessionToCardio(session) {
  const run = session.run || {};
  const avgHr = typeof run.avgHr === "number" && Number.isFinite(run.avgHr) && run.avgHr > 0 ? run.avgHr : null;
  return {
    ...session,
    kind: "cardio",
    cardio: {
      activity: "running",
      minutes: num(run.minutes, 0),
      avgHr,
      distanceKm: null,
      rpe: null,
      note: str(run.pace, ""),
    },
  };
}

async function migrateToV2() {
  const flag = await get("kv", "migrations");
  if (flag?.v2) return;
  const sessions = await getAll("sessions");
  const toMigrate = sessions.filter((s) => s.kind === "run").map(runSessionToCardio);
  if (toMigrate.length > 0) await bulkPut("sessions", toMigrate);
  await put("kv", { ...(flag || {}), key: "migrations", v2: true });
}

function tx(storeName, mode, fn) {
  return openDB().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const out = fn(store);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getAll(storeName) {
  return openDB().then((d) => reqResult(d.transaction(storeName).objectStore(storeName).getAll()));
}

export function get(storeName, key) {
  return openDB().then((d) => reqResult(d.transaction(storeName).objectStore(storeName).get(key)));
}

export function put(storeName, value) {
  return tx(storeName, "readwrite", (s) => { s.put(value); });
}

export function del(storeName, key) {
  return tx(storeName, "readwrite", (s) => { s.delete(key); });
}

export function clear(storeName) {
  return tx(storeName, "readwrite", (s) => { s.clear(); });
}

export function bulkPut(storeName, values) {
  return tx(storeName, "readwrite", (s) => { for (const v of values) s.put(v); });
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------- settings

export const DEFAULT_SETTINGS = {
  key: "settings",
  inventory: {
    dumbbells: [5, 10, 15, 17.5, 20, 22.5, 25, 27.5, 30, 35, 40, 45, 50],
    // Full known/generated pool; dumbbells above is the ENABLED subset.
    // Defaults to a copy of dumbbells when absent (see getSettings below).
    dumbbellPool: [],
    plateMin: 2.5,
    cableStep: 2.5,
    machineStep: 5,
    overrides: {},
  },
  language: "ko",
  theme: "system",
  // Display unit for load values: stored values never change meaning, this
  // only affects formatting (js/rules.js formatLoad / parseLoadInput).
  displayUnit: "both",
  restDefaultSec: 90,
  restOverrides: {}, // exerciseId -> seconds
  recoveryRule: { gapDays: 14, factor: 0.83 },
  recovery: { active: false, startedAt: null },
  lastBackupAt: null,
  // Bodyweight unit (B4): independent of displayUnit (which governs load
  // formatting only). Governs bodyweight entry + protein coefficient display;
  // storage always stays kg.
  bodyweightUnit: "kg",
  // Protein target coefficient, g per kg bodyweight (B3). Documented ranges:
  // general 1.2-1.6, hypertrophy 1.6-2.2, cutting 1.8-2.7 g/kg.
  proteinCoef: 1.6,
  // Water guide (B2): a cup is cupMl; waterTargetMl is a guide, not a cap.
  waterTargetMl: 2000,
  cupMl: 250,
};

export async function getSettings() {
  const saved = await get("kv", "settings");
  const inventory = { ...DEFAULT_SETTINGS.inventory, ...(saved?.inventory || {}) };
  if (!Array.isArray(inventory.dumbbellPool) || inventory.dumbbellPool.length === 0) {
    inventory.dumbbellPool = [...(inventory.dumbbells || [])].sort((a, b) => a - b);
  }
  return {
    ...DEFAULT_SETTINGS,
    ...(saved || {}),
    inventory,
    recoveryRule: { ...DEFAULT_SETTINGS.recoveryRule, ...(saved?.recoveryRule || {}) },
    recovery: { ...DEFAULT_SETTINGS.recovery, ...(saved?.recovery || {}) },
    restOverrides: { ...DEFAULT_SETTINGS.restOverrides, ...(saved?.restOverrides || {}) },
    key: "settings",
  };
}

export function saveSettings(settings) {
  return put("kv", { ...settings, key: "settings" });
}

export async function requestPersist() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* not supported */ }
  return false;
}

// -------------------------------------------------------------------- water

export function getWater(date) {
  return get("water", date);
}

export function putWater(date, ml) {
  return put("water", { date, ml });
}

// ------------------------------------------------------- pack import/export

// Whitelist copies: imported JSON is untrusted input, so only known fields
// with expected primitive types cross into the database.
const str = (v, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const boolVal = (v) => v === true;

function sanitizeExercise(e) {
  if (!e || typeof e !== "object" || typeof e.id !== "string" || typeof e.name !== "string") return null;
  return {
    id: e.id,
    name: e.name,
    bodyPart: str(e.bodyPart, "full"),
    equipment: str(e.equipment, "machine"),
    unit: e.unit === "kg" ? "kg" : "lb",
    loadConvention: str(e.loadConvention, "total"),
    variant: str(e.variant, ""),
    spinalLoad: boolVal(e.spinalLoad),
    // Target-emphasis label (C2), e.g. "광배근 상부": feeds session display and
    // the weekly body-part balance stats. Empty string means no emphasis set.
    emphasis: str(e.emphasis, ""),
  };
}

function sanitizeSet(s) {
  if (!s || typeof s !== "object") return null;
  return {
    weight: num(s.weight),
    reps: num(s.reps),
    effort: ["hard", "normal", "easy"].includes(s.effort) ? s.effort : null,
    warmup: boolVal(s.warmup),
    // Drop set (C1): an extra set performed immediately after the last
    // working set at reduced load. Ignored by the nextLoad verdict, same as
    // warm-ups, but counted as a working set everywhere else (log, balance).
    drop: boolVal(s.drop),
  };
}

const PROGRAM_METHODS = ["pyramid", "superset", "dropset"];

function sanitizeProgram(p) {
  if (!p || typeof p !== "object" || typeof p.id !== "string" || typeof p.name !== "string") return null;
  const kinds = ["weights", "cardio", "calisthenics"];
  return {
    id: p.id,
    name: p.name,
    kind: kinds.includes(p.kind) ? p.kind : "weights",
    items: Array.isArray(p.items)
      ? p.items.filter((i) => i && typeof i.exerciseId === "string").map((i) => {
          const method = PROGRAM_METHODS.includes(i.method) ? i.method : null;
          const out = {
            exerciseId: i.exerciseId,
            sets: num(i.sets, 3),
            reps: i.reps === "max" ? "max" : num(i.reps, 8),
            targetLoad: num(i.targetLoad),
            warmupSets: num(i.warmupSets),
            method,
          };
          // Superset pairing (C1): both paired items carry the same group id;
          // kept only when the method is actually "superset" so a cleared
          // pairing never leaves a stale group id behind.
          if (method === "superset") out.supersetGroup = str(i.supersetGroup, "");
          return out;
        })
      : [],
  };
}

// Cardio detail (B1): activity is either one of the fixed slugs or free text
// typed for "custom"; rpe is the same 3-level scale used for effort.
function sanitizeCardio(c) {
  if (!c || typeof c !== "object") return null;
  return {
    activity: str(c.activity, "running"),
    minutes: num(c.minutes),
    distanceKm: typeof c.distanceKm === "number" && Number.isFinite(c.distanceKm) ? c.distanceKm : null,
    avgHr: typeof c.avgHr === "number" && Number.isFinite(c.avgHr) && c.avgHr > 0 ? c.avgHr : null,
    rpe: ["easy", "normal", "hard"].includes(c.rpe) ? c.rpe : null,
    note: str(c.note, ""),
  };
}

function sanitizeSession(s) {
  if (!s || typeof s !== "object" || typeof s.id !== "string" || typeof s.date !== "string") return null;
  const kinds = ["weights", "cardio", "calisthenics"];
  // Legacy pack import: "run" is accepted and mapped to "cardio", exactly
  // like the in-place v1 -> v2 database migration (runSessionToCardio above).
  const kindRaw = s.kind === "run" ? "cardio" : s.kind;
  const kind = kinds.includes(kindRaw) ? kindRaw : "weights";
  const daily = s.daily && typeof s.daily === "object" ? s.daily : {};
  const pain = {};
  if (daily.pain && typeof daily.pain === "object") {
    for (const [area, v] of Object.entries(daily.pain)) pain[str(area)] = num(v);
  }

  const run = s.run && typeof s.run === "object"
    ? { minutes: num(s.run.minutes), avgHr: num(s.run.avgHr) || null, pace: str(s.run.pace, "") }
    : null;

  let cardio = sanitizeCardio(s.cardio);
  if (!cardio && s.kind === "run" && run) {
    cardio = sanitizeCardio({
      activity: "running",
      minutes: run.minutes,
      avgHr: run.avgHr,
      distanceKm: null,
      rpe: null,
      note: run.pace,
    });
  }

  return {
    id: s.id,
    date: s.date,
    kind,
    programId: str(s.programId, ""),
    programName: str(s.programName, ""),
    recovery: boolVal(s.recovery),
    startedAt: num(s.startedAt, 0) || null,
    endedAt: num(s.endedAt, 0) || null,
    daily: {
      sleepH: num(daily.sleepH, 0) || null,
      condition: num(daily.condition, 0) || null,
      pain,
      heat: boolVal(daily.heat),
      proteinOk: boolVal(daily.proteinOk),
      note: str(daily.note, ""),
    },
    entries: Array.isArray(s.entries)
      ? s.entries.filter((e) => e && typeof e.exerciseId === "string").map((e) => ({
          exerciseId: e.exerciseId,
          targetReps: e.targetReps === "max" ? "max" : num(e.targetReps, 0) || null,
          sets: Array.isArray(e.sets) ? e.sets.map(sanitizeSet).filter(Boolean) : [],
        }))
      : [],
    // Legacy field, kept untouched for no-data-loss (matches the migration).
    run,
    cardio,
  };
}

// Plausibility gates keep obviously-bad imported numbers out (B5): percent
// body fat and skeletal muscle mass both have wide but bounded human ranges.
function sanitizeBodyweight(b) {
  if (!b || typeof b !== "object" || typeof b.date !== "string") return null;
  const bodyFatPct = typeof b.bodyFatPct === "number" && Number.isFinite(b.bodyFatPct) && b.bodyFatPct >= 3 && b.bodyFatPct <= 70
    ? b.bodyFatPct
    : null;
  const muscleMassKg = typeof b.muscleMassKg === "number" && Number.isFinite(b.muscleMassKg) && b.muscleMassKg >= 10 && b.muscleMassKg <= 80
    ? b.muscleMassKg
    : null;
  return { date: b.date, kg: num(b.kg), fasted: boolVal(b.fasted), bodyFatPct, muscleMassKg };
}

// Daily water record for backup round-trips: {date, ml}. Optional in packs
// so packs exported by older versions keep importing unchanged.
function sanitizeWater(w) {
  if (!w || typeof w !== "object" || typeof w.date !== "string") return null;
  const ml = num(w.ml);
  if (ml < 0) return null;
  return { date: w.date, ml };
}

export function validatePack(pack) {
  const errors = [];
  if (!pack || typeof pack !== "object") errors.push("not-an-object");
  else {
    if (pack.formatVersion !== PACK_FORMAT_VERSION) errors.push("bad-format-version");
    for (const k of ["exercises", "programs", "sessions", "bodyweight", "water"]) {
      if (pack[k] !== undefined && !Array.isArray(pack[k])) errors.push(`bad-${k}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// Shared sanitize step (D1): both importPack (my data) and importGuestPack
// (read-only guest snapshot) whitelist-copy the same four arrays through the
// same per-record sanitizers, so a guest pack is held to identical scrutiny
// as untrusted input entering my own stores.
function sanitizePack(pack) {
  const exercises = (pack.exercises || []).map(sanitizeExercise).filter(Boolean);
  const programs = (pack.programs || []).map(sanitizeProgram).filter(Boolean);
  const sessions = (pack.sessions || []).map(sanitizeSession).filter(Boolean);
  const bodyweight = (pack.bodyweight || []).map(sanitizeBodyweight).filter(Boolean);
  return { exercises, programs, sessions, bodyweight };
}

export async function importPack(pack, mode = "merge") {
  const check = validatePack(pack);
  if (!check.ok) throw new Error("invalid-pack: " + check.errors.join(","));

  const { exercises, programs, sessions, bodyweight } = sanitizePack(pack);
  const water = (pack.water || []).map(sanitizeWater).filter(Boolean);

  if (mode === "replace") {
    await clear("exercises");
    await clear("programs");
    await clear("sessions");
    await clear("bodyweight");
    await clear("water");
  }
  await bulkPut("exercises", exercises);
  await bulkPut("programs", programs);
  await bulkPut("sessions", sessions);
  await bulkPut("bodyweight", bodyweight);
  await bulkPut("water", water);

  return { exercises: exercises.length, programs: programs.length, sessions: sessions.length, bodyweight: bodyweight.length, water: water.length };
}

// ------------------------------------------------------------ guest profiles
//
// Guests (D1) never touch my stores or acquire profileId fields on my data:
// each guest lives entirely inside one kv record "guest:<id>" holding the
// SAME sanitized shape as my data (exercises/programs/sessions/bodyweight),
// so every existing aggregate (stats, suggestions, exports, today) stays
// untouched by construction; they simply never read guest: kv records. The
// registry ("guests" kv record) is a small index for the settings list and
// the log/stats profile switchers.

async function loadGuestRegistry() {
  const reg = await get("kv", "guests");
  return reg && Array.isArray(reg.list) ? reg : { key: "guests", list: [] };
}

export async function importGuestPack(pack, name) {
  const check = validatePack(pack);
  if (!check.ok) throw new Error("invalid-pack: " + check.errors.join(","));

  const data = sanitizePack(pack);
  const counts = {
    exercises: data.exercises.length,
    programs: data.programs.length,
    sessions: data.sessions.length,
    bodyweight: data.bodyweight.length,
  };

  const id = newId("guest");
  const importedAt = new Date().toISOString();
  const record = { key: `guest:${id}`, id, name: String(name || ""), importedAt, counts, data };
  await put("kv", record);

  const registry = await loadGuestRegistry();
  registry.list = [...registry.list, { id, name: record.name, importedAt, counts }];
  await put("kv", registry);

  return counts;
}

export async function getGuests() {
  const registry = await loadGuestRegistry();
  return registry.list;
}

export async function getGuestData(id) {
  const record = await get("kv", `guest:${id}`);
  return record ? record.data : null;
}

export async function deleteGuest(id) {
  await del("kv", `guest:${id}`);
  const registry = await loadGuestRegistry();
  registry.list = registry.list.filter((g) => g.id !== id);
  await put("kv", registry);
}

export async function exportPack() {
  const [exercises, programs, sessions, bodyweight, water] = await Promise.all([
    getAll("exercises"), getAll("programs"), getAll("sessions"), getAll("bodyweight"), getAll("water"),
  ]);
  return {
    formatVersion: PACK_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exercises, programs, sessions, bodyweight, water,
  };
}
