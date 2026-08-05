// Pure rule engine. No DOM, no storage, no clock: every function takes
// explicit inputs and returns plain data, so node --test covers it directly.
//
// Domain rules encoded here come from training-program-reference.md:
//   3.7 progression (stabilize, then add; ~2-3%/month realistic)
//   3.6 return-from-layoff (83% of last load, weeks 1-2, back at week 3)
//   3.2 weekly volume target (10-20 sets per body part)
// Dates are ISO "YYYY-MM-DD" strings; effort is "hard" | "normal" | "easy".

const DAY_MS = 86400000;

export function workingSets(sets) {
  return (sets || []).filter((s) => !s.warmup);
}

export function repsMet(sets, targetReps) {
  if (targetReps === "max") return true;
  return sets.every((s) => s.reps >= targetReps);
}

// Available load steps for an exercise, ascending. Overrides win over
// equipment-type defaults. Barbell/Smith steps move in plate PAIRS, and all
// barbell/Smith loads exclude the bar (project convention).
export function inventorySteps(exercise, inventory) {
  const ov = inventory?.overrides?.[exercise.id];
  if (Array.isArray(ov)) return [...ov].sort((a, b) => a - b);

  const max = ov && typeof ov === "object" && ov.max != null ? ov.max : null;
  const range = (step, hardMax) => {
    const out = [];
    for (let v = 0; v <= hardMax + 1e-9; v = +(v + step).toFixed(2)) out.push(v);
    return out;
  };

  let steps;
  switch (exercise.equipment) {
    case "dumbbell":
      steps = [...(inventory?.dumbbells || [])].sort((a, b) => a - b);
      break;
    case "barbell":
    case "smith": {
      const pair = (inventory?.plateMin ?? 2.5) * 2;
      steps = range(pair, max ?? inventory?.barbellMax ?? 500);
      break;
    }
    case "cable":
      steps = range(inventory?.cableStep ?? 2.5, max ?? inventory?.cableMax ?? 120);
      break;
    case "bodyweight":
      steps = [0];
      break;
    default:
      steps = range(inventory?.machineStep ?? 5, max ?? inventory?.machineMax ?? 500);
  }
  if (max != null) steps = steps.filter((v) => v <= max + 1e-9);
  return steps;
}

export function snapDown(value, steps) {
  let best = null;
  for (const s of steps) if (s <= value + 1e-9) best = s;
  return best;
}

export function stepUp(current, steps) {
  for (const s of steps) if (s > current + 1e-9) return s;
  return null; // already at the top of what the gym has
}

export function stepDown(current, steps) {
  let best = null;
  for (const s of steps) if (s < current - 1e-9) best = s;
  return best;
}

// Next-load suggestion (reference 3.7, simple state rule chosen in plan):
//   all working sets hit target reps AND all rated easy -> raise one step
//   any missed reps -> hold; missed in the previous session too -> lower one step
//   any hard -> hold; otherwise (normal present) -> hold
export function nextLoad({ sets, targetReps, currentLoad, steps, prevMissedReps = false }) {
  const ws = workingSets(sets);
  if (ws.length === 0) return { action: "hold", load: currentLoad, reason: "no-working-sets" };

  const missed = !repsMet(ws, targetReps);
  if (missed && prevMissedReps) {
    const lower = stepDown(currentLoad, steps);
    return lower == null
      ? { action: "hold", load: currentLoad, reason: "missed-twice-at-floor" }
      : { action: "decrease", load: lower, reason: "missed-twice" };
  }
  if (missed) return { action: "hold", load: currentLoad, reason: "missed-reps" };
  if (ws.some((s) => s.effort === "hard")) return { action: "hold", load: currentLoad, reason: "hard" };
  if (ws.every((s) => s.effort === "easy")) {
    const higher = stepUp(currentLoad, steps);
    return higher == null
      ? { action: "hold", load: currentLoad, reason: "at-max" }
      : { action: "increase", load: higher, reason: "all-easy" };
  }
  return { action: "hold", load: currentLoad, reason: "normal" };
}

// Return-from-layoff load (reference 3.6): factor of the last recorded load,
// snapped DOWN to an available step so it is never above the prescription.
export function recoveryLoad(lastLoad, factor, steps) {
  const target = lastLoad * factor;
  const snapped = snapDown(target, steps);
  return snapped == null ? (steps[0] ?? 0) : snapped;
}

export function gapDays(lastISO, todayISO) {
  return Math.floor((Date.parse(todayISO + "T00:00:00Z") - Date.parse(lastISO + "T00:00:00Z")) / DAY_MS);
}

export function shouldSuggestRecovery(lastISO, todayISO, thresholdDays) {
  if (!lastISO) return false;
  return gapDays(lastISO, todayISO) >= thresholdDays;
}

// 1-based recovery week since recovery mode started.
export function recoveryWeek(startISO, todayISO) {
  return Math.floor(Math.max(0, gapDays(startISO, todayISO)) / 7) + 1;
}

// Monday-start calendar week id: the ISO date of that week's Monday.
export function weekKey(dateISO) {
  const d = new Date(dateISO + "T00:00:00Z");
  const shift = (d.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

// Working sets per body part for the given Monday-week, weights sessions only.
// Variants are separate exercises but aggregate through their bodyPart.
export function weeklyBalance(sessions, exercisesById, weekKeyStr) {
  const totals = {};
  for (const session of sessions) {
    if (session.kind !== "weights") continue;
    if (weekKey(session.date) !== weekKeyStr) continue;
    for (const entry of session.entries || []) {
      const ex = exercisesById[entry.exerciseId];
      if (!ex) continue;
      totals[ex.bodyPart] = (totals[ex.bodyPart] || 0) + workingSets(entry.sets).length;
    }
  }
  return totals;
}

// Percent change between the latest load and the closest entry >= windowDays
// earlier. history: [{date, load}] in any order. Returns null when the
// window has no comparison point.
export function monthlyProgressPct(history, windowDays = 28) {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  let prior = null;
  for (const h of sorted) {
    if (gapDays(h.date, latest.date) >= windowDays) prior = h;
  }
  if (!prior || prior.load === 0) return null;
  return ((latest.load - prior.load) / prior.load) * 100;
}

// Reference 3.7: realistic progression is 2-3%/month. Warn only when the
// measured rate clearly overshoots that (default: more than double).
export function overshootWarning(history, limitPct = 3, marginFactor = 2) {
  const pct = monthlyProgressPct(history);
  if (pct == null) return null;
  if (pct > limitPct * marginFactor) return { pct: Math.round(pct * 10) / 10 };
  return null;
}

// -------------------------------------------------- units / rest (v1.1, A)
//
// Storage values never change meaning: a load stays in its exercise's
// storedUnit forever. These helpers only translate for FORMATTING (display)
// and for reading typed input BACK into storedUnit before it is saved.

export const KG_PER_LB = 0.45359237;

// Display-oriented by default (rounded to 0.1, the mockup's precision).
// Pass { round: false } to get the raw value, e.g. when round-tripping a
// typed value back into storage (parseLoadInput rounds to 2 decimals itself).
export function lbToKg(lb, { round = true } = {}) {
  const kg = lb * KG_PER_LB;
  return round ? Math.round(kg * 10) / 10 : kg;
}

export function kgToLb(kg, { round = true } = {}) {
  const lb = kg / KG_PER_LB;
  return round ? Math.round(lb * 10) / 10 : lb;
}

// Converts a value FROM fromUnit to the other of the two known units.
function convertFromUnit(value, fromUnit, round = true) {
  return fromUnit === "lb" ? lbToKg(value, { round }) : kgToLb(value, { round });
}

function formatNum(v) {
  // Trim float noise (e.g. 40.800000000000004) without forcing decimals.
  return String(Math.round(v * 100) / 100);
}

// storedUnit: "kg" | "lb" - the unit the value is actually persisted in.
// displayUnit: "both" | "kg" | "lb" - the user's global display preference.
//   "both"          -> stored value first, converted value in parentheses,
//                       e.g. stored 90 lb -> "90 lb (40.8 kg)".
//   "kg" | "lb"      -> only that unit; converts when it differs from
//                       storedUnit, and shows the stored value plain (no
//                       parentheses, no duplicate) when it already matches.
export function formatLoad(value, storedUnit, displayUnit) {
  const su = storedUnit === "kg" ? "kg" : "lb";

  if (displayUnit === "kg" || displayUnit === "lb") {
    if (displayUnit === su) return `${formatNum(value)} ${su}`;
    return `${formatNum(convertFromUnit(value, su))} ${displayUnit}`;
  }

  // "both" (or any unrecognized value falls back to both, the safest default)
  const otherUnit = su === "kg" ? "lb" : "kg";
  const converted = convertFromUnit(value, su);
  return `${formatNum(value)} ${su} (${formatNum(converted)} ${otherUnit})`;
}

// Reads text typed in the ACTIVE display unit (or storedUnit itself when
// displayUnit is "both", since "both" mode always edits in storedUnit) and
// converts it back to storedUnit, rounded to 2 decimals for storage.
export function parseLoadInput(text, storedUnit, displayUnit) {
  const n = Number(text);
  const value = Number.isFinite(n) ? n : 0;
  const su = storedUnit === "kg" ? "kg" : "lb";
  const inputUnit = displayUnit === "kg" || displayUnit === "lb" ? displayUnit : su;
  const stored = inputUnit === su ? value : convertFromUnit(value, inputUnit, false);
  return Math.round(stored * 100) / 100;
}

// Per-exercise rest override wins over the global default (A2).
export function restSecondsFor(exerciseId, settings) {
  const ov = settings?.restOverrides?.[exerciseId];
  if (typeof ov === "number" && Number.isFinite(ov)) return ov;
  return settings?.restDefaultSec ?? 90;
}

// ---------------------------------------------- cardio / body comp (v1.1, B)

function round1(v) {
  return Math.round(v * 10) / 10;
}

// Protein target in grams, rounded to a whole gram (B3).
export function proteinTargetG(weightKg, coef) {
  return Math.round(weightKg * coef);
}

// Coefficient display follows the bodyweight unit (B3/B4): g/kg as configured,
// or the g/lb equivalent (coef * KG_PER_LB, rounded to 0.01) in lb mode.
export function proteinCoefDisplay(coef, bodyweightUnit) {
  if (bodyweightUnit === "lb") {
    const perLb = Math.round(coef * KG_PER_LB * 100) / 100;
    return `${perLb} g/lb`;
  }
  return `${Math.round(coef * 100) / 100} g/kg`;
}

// Bodyweight-unit-aware display, rounded to 0.1 (B4): "74.8 kg" / "164.9 lb".
export function bodyweightDisplay(kg, unit) {
  if (unit === "lb") return `${kgToLb(kg)} lb`;
  return `${round1(kg)} kg`;
}

// Fat-free (lean) mass in kg, or null when body fat percent is unknown (B5).
export function leanMassKg(weightKg, bodyFatPct) {
  if (bodyFatPct == null) return null;
  return round1(weightKg * (1 - bodyFatPct / 100));
}

// Pace text (B1), e.g. "6'40\"/km"; null when either input is missing/zero.
export function paceText(minutes, distanceKm) {
  if (!minutes || !distanceKm) return null;
  const perKm = minutes / distanceKm;
  let mm = Math.floor(perKm);
  let ss = Math.round((perKm - mm) * 60);
  if (ss === 60) { mm += 1; ss = 0; }
  return `${mm}'${String(ss).padStart(2, "0")}"/km`;
}

// Total cardio minutes logged in the given Monday-week (B6). Cardio sessions
// only; mirrors weeklyBalance's weekKeyStr convention.
export function weeklyCardioMinutes(sessions, weekKeyStr) {
  let total = 0;
  for (const session of sessions) {
    if (session.kind !== "cardio" || !session.cardio) continue;
    if (weekKey(session.date) !== weekKeyStr) continue;
    const minutes = Number(session.cardio.minutes);
    if (Number.isFinite(minutes)) total += minutes;
  }
  return total;
}
