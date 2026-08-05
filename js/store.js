// IndexedDB persistence layer: thin promise wrapper, schema, settings,
// and the program-pack export/import (the same JSON shape both ways).
// All personal data lives here on the device; the repo ships nothing personal.

const DB_NAME = "training-tracker";
const DB_VERSION = 1;
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
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
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
  };
}

function sanitizeSet(s) {
  if (!s || typeof s !== "object") return null;
  return {
    weight: num(s.weight),
    reps: num(s.reps),
    effort: ["hard", "normal", "easy"].includes(s.effort) ? s.effort : null,
    warmup: boolVal(s.warmup),
  };
}

function sanitizeProgram(p) {
  if (!p || typeof p !== "object" || typeof p.id !== "string" || typeof p.name !== "string") return null;
  const kinds = ["weights", "run", "calisthenics"];
  return {
    id: p.id,
    name: p.name,
    kind: kinds.includes(p.kind) ? p.kind : "weights",
    items: Array.isArray(p.items)
      ? p.items.filter((i) => i && typeof i.exerciseId === "string").map((i) => ({
          exerciseId: i.exerciseId,
          sets: num(i.sets, 3),
          reps: i.reps === "max" ? "max" : num(i.reps, 8),
          targetLoad: num(i.targetLoad),
          warmupSets: num(i.warmupSets),
        }))
      : [],
  };
}

function sanitizeSession(s) {
  if (!s || typeof s !== "object" || typeof s.id !== "string" || typeof s.date !== "string") return null;
  const kinds = ["weights", "run", "calisthenics"];
  const daily = s.daily && typeof s.daily === "object" ? s.daily : {};
  const pain = {};
  if (daily.pain && typeof daily.pain === "object") {
    for (const [area, v] of Object.entries(daily.pain)) pain[str(area)] = num(v);
  }
  return {
    id: s.id,
    date: s.date,
    kind: kinds.includes(s.kind) ? s.kind : "weights",
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
    run: s.run && typeof s.run === "object"
      ? { minutes: num(s.run.minutes), avgHr: num(s.run.avgHr) || null, pace: str(s.run.pace, "") }
      : null,
  };
}

function sanitizeBodyweight(b) {
  if (!b || typeof b !== "object" || typeof b.date !== "string") return null;
  return { date: b.date, kg: num(b.kg), fasted: boolVal(b.fasted) };
}

export function validatePack(pack) {
  const errors = [];
  if (!pack || typeof pack !== "object") errors.push("not-an-object");
  else {
    if (pack.formatVersion !== PACK_FORMAT_VERSION) errors.push("bad-format-version");
    for (const k of ["exercises", "programs", "sessions", "bodyweight"]) {
      if (pack[k] !== undefined && !Array.isArray(pack[k])) errors.push(`bad-${k}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function importPack(pack, mode = "merge") {
  const check = validatePack(pack);
  if (!check.ok) throw new Error("invalid-pack: " + check.errors.join(","));

  const exercises = (pack.exercises || []).map(sanitizeExercise).filter(Boolean);
  const programs = (pack.programs || []).map(sanitizeProgram).filter(Boolean);
  const sessions = (pack.sessions || []).map(sanitizeSession).filter(Boolean);
  const bodyweight = (pack.bodyweight || []).map(sanitizeBodyweight).filter(Boolean);

  if (mode === "replace") {
    await clear("exercises");
    await clear("programs");
    await clear("sessions");
    await clear("bodyweight");
  }
  await bulkPut("exercises", exercises);
  await bulkPut("programs", programs);
  await bulkPut("sessions", sessions);
  await bulkPut("bodyweight", bodyweight);

  return { exercises: exercises.length, programs: programs.length, sessions: sessions.length, bodyweight: bodyweight.length };
}

export async function exportPack() {
  const [exercises, programs, sessions, bodyweight] = await Promise.all([
    getAll("exercises"), getAll("programs"), getAll("sessions"), getAll("bodyweight"),
  ]);
  return {
    formatVersion: PACK_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exercises, programs, sessions, bodyweight,
  };
}
