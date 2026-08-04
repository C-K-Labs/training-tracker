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
