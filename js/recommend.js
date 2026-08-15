// Program recommendation (v1.10.0): reuses the course generator (js/gen.js),
// but picks its inputs from the user's OWN history (actual weekly frequency,
// actual session length) and seeds starting loads from the user's known
// lifts instead of leaving every targetLoad at 0.
//
// Load inference is deliberately conservative: the exact same movement
// reuses the user's target load; a same-family movement inherits a reduced
// fraction and snaps DOWN to an available inventory step. The first
// session's reps/effort verdicts then correct the number, so erring low is
// safe and erring high is not. Cross-equipment inference is limited to
// machine<->cable (both stack-style loads); per-hand dumbbell numbers never
// map onto stack or bar totals and vice versa.

import { CATALOG, generateCourse } from "./gen.js";
import { ALIASES } from "./tips.js";
import * as rules from "./rules.js";

// Movement families for near-equivalent load inference. Only loadable
// movements appear; bodyweight work always keeps load 0.
const FAMILY = {
  "smith-squat": "squat", "goblet-squat": "squat", "leg-press": "squat",
  "rdl": "hinge", "sumo-deadlift": "hinge",
  "smith-bench": "hpush", "bench-press": "hpush",
  "incline-db-press": "ipush",
  "overhead-press": "vpush",
  "lat-pulldown": "vpull",
  "seated-cable-row": "hpull", "standing-cable-row": "hpull", "db-row": "hpull", "smith-barbell-row": "hpull",
  "pec-deck-fly": "fly", "db-fly": "fly",
  "lateral-raise": "sdelt",
  "reverse-pec-deck": "rdelt", "face-pull": "rdelt", "reverse-fly-db": "rdelt",
  "leg-curl": "hamcurl",
  "leg-extension": "quadext",
  "hip-thrust": "glute",
  "triceps-pushdown": "triceps", "overhead-triceps-ext": "triceps",
  "db-curl": "biceps", "hammer-curl": "biceps",
  "calf-raise": "calf", "calf-raise-db": "calf",
};

const STACK_LIKE = new Set(["machine", "cable"]);

function equipmentOf(key) {
  return CATALOG[key] ? CATALOG[key].equipment : null;
}

// 1 = same movement, 0.9 = same family + same equipment (or smith<->barbell,
// both bar-excluded totals), 0.8 = same family across machine<->cable,
// 0 = no defensible inference.
export function pairFactor(targetKey, sourceKey) {
  if (targetKey === sourceKey) return 1;
  const family = FAMILY[targetKey];
  if (!family || family !== FAMILY[sourceKey]) return 0;
  const te = equipmentOf(targetKey);
  const se = equipmentOf(sourceKey);
  if (!te || !se) return 0;
  if (te === se) return 0.9;
  if (STACK_LIKE.has(te) && STACK_LIKE.has(se)) return 0.8;
  if ((te === "smith" && se === "barbell") || (te === "barbell" && se === "smith")) return 0.9;
  return 0;
}

// The user's current strength map: catalog key -> best target load in lb,
// resolved through the same id aliases the tips use (the personal pack uses
// db-ohp, lat-pulldown-close, pushup-home). kg-stored loads convert to lb
// because generated exercises are always lb.
export function userLoadsByKey(programs, exercisesById) {
  const out = {};
  for (const program of programs || []) {
    if (program.kind !== "weights") continue;
    for (const item of program.items || []) {
      const load = Number(item.targetLoad);
      if (!Number.isFinite(load) || load <= 0) continue;
      const key = CATALOG[item.exerciseId] ? item.exerciseId : ALIASES[item.exerciseId];
      if (!key) continue;
      const ex = exercisesById ? exercisesById[item.exerciseId] : null;
      const lb = ex && ex.unit === "kg" ? rules.kgToLb(load, { round: false }) : load;
      if (!(key in out) || lb > out[key]) out[key] = lb;
    }
  }
  return out;
}

// Fills targetLoad in place on a generated course. Returns how many items
// received a load. Snapping goes through rules.recoveryLoad, which snaps
// DOWN to the exercise's available steps (never above the inferred number).
export function inferCourseLoads(course, loadsByKey, settings, idPrefix) {
  const genExById = Object.fromEntries(course.exercises.map((e) => [e.id, e]));
  let filled = 0;
  for (const program of course.programs) {
    for (const item of program.items) {
      const genEx = genExById[item.exerciseId];
      if (!genEx || genEx.equipment === "bodyweight") continue;
      const key = item.exerciseId.slice(idPrefix.length + 1);
      let best = null;
      for (const [srcKey, lb] of Object.entries(loadsByKey)) {
        const factor = pairFactor(key, srcKey);
        if (factor > 0 && (!best || factor > best.factor)) best = { lb, factor };
      }
      if (!best) continue;
      const steps = rules.inventorySteps(genEx, settings.inventory);
      const load = rules.recoveryLoad(best.lb * best.factor, 1, steps);
      if (load > 0) {
        item.targetLoad = Math.round(load * 100) / 100;
        filled += 1;
      }
    }
  }
  return filled;
}

// History-derived generator inputs: weights sessions completed in the last
// 28 days set the weekly frequency (clamped to the splits the generator
// ships) and the average session length (snapped to the generator's
// sessionMinutes options). Fewer than 4 recent sessions falls back to the
// 3-day/60-min default, flagged so the UI can say why.
export function recommendInput(sessions, now = new Date()) {
  const cutoff = new Date(now.getTime() - 27 * 24 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  const cutoffISO = `${cutoff.getFullYear()}-${p(cutoff.getMonth() + 1)}-${p(cutoff.getDate())}`;
  const recent = (sessions || []).filter((s) => s.kind === "weights" && s.endedAt && s.date >= cutoffISO);

  if (recent.length < 4) return { days: 3, minutes: 60, hasHistory: false };

  const days = Math.min(6, Math.max(2, Math.round(recent.length / 4)));
  const avgMin = recent.reduce((sum, s) => sum + Math.max(0, (s.endedAt - s.startedAt) / 60000), 0) / recent.length;
  const options = [30, 45, 60, 90];
  const minutes = options.reduce((bestOpt, o) => (Math.abs(o - avgMin) < Math.abs(bestOpt - avgMin) ? o : bestOpt), 60);
  return { days, minutes, hasHistory: true };
}

export function buildCourse(days, minutes, idPrefix) {
  return generateCourse(
    { goal: "hypertrophy", daysPerWeek: days, experience: "intermediate", equipment: "gym", sessionMinutes: minutes },
    { idPrefix },
  );
}
