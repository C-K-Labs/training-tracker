import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inventorySteps, snapDown, stepUp, stepDown,
  nextLoad, recoveryLoad,
  gapDays, shouldSuggestRecovery, recoveryWeek,
  weekKey, weeklyBalance, emphasisBreakdown,
  monthlyProgressPct, overshootWarning,
  KG_PER_LB, lbToKg, kgToLb, formatLoad, parseLoadInput, restSecondsFor,
  proteinTargetG, proteinCoefDisplay, bodyweightDisplay, leanMassKg,
  paceText, weeklyCardioMinutes,
  pyramidPlan, dropChain,
  warmupDefaultLoad, orderTrendExercises, workingSets,
} from "../js/rules.js";

const INVENTORY = {
  dumbbells: [5, 10, 15, 17.5, 20, 22.5, 25, 27.5, 30, 35, 40],
  plateMin: 2.5,        // smith/barbell move in 5 lb pair increments
  cableStep: 2.5,       // kg
  machineStep: 5,
  overrides: {
    "leg-press": { max: 280 },
  },
};

const smith = { id: "smith-squat", equipment: "smith" };
const dumbbell = { id: "ohp", equipment: "dumbbell" };
const legPress = { id: "leg-press", equipment: "machine" };
const pullUp = { id: "pull-up", equipment: "bodyweight" };

const smithSteps = inventorySteps(smith, INVENTORY);

test("inventorySteps: smith moves in plate-pair increments", () => {
  assert.equal(smithSteps[0], 0);
  assert.equal(smithSteps[1], 5);
  assert.ok(smithSteps.includes(90));
  assert.ok(smithSteps.includes(95));
});

test("inventorySteps: dumbbell uses the configured list, sorted", () => {
  assert.deepEqual(inventorySteps(dumbbell, INVENTORY).slice(0, 4), [5, 10, 15, 17.5]);
});

test("inventorySteps: override max caps the machine (leg press 280)", () => {
  const steps = inventorySteps(legPress, INVENTORY);
  assert.equal(steps[steps.length - 1], 280);
});

test("inventorySteps: bodyweight is a single zero step", () => {
  assert.deepEqual(inventorySteps(pullUp, INVENTORY), [0]);
});

test("snap and step helpers", () => {
  assert.equal(snapDown(74.7, smithSteps), 70);
  assert.equal(stepUp(90, smithSteps), 95);
  assert.equal(stepDown(90, smithSteps), 85);
  assert.equal(stepUp(280, inventorySteps(legPress, INVENTORY)), null);
});

const sets = (list) => list.map(([reps, effort, warmup]) => ({ weight: 90, reps, effort, warmup: !!warmup }));

test("nextLoad: all easy at target reps raises one step", () => {
  const r = nextLoad({ sets: sets([[8, "easy"], [8, "easy"], [8, "easy"]]), targetReps: 8, currentLoad: 90, steps: smithSteps });
  assert.deepEqual({ action: r.action, load: r.load }, { action: "increase", load: 95 });
});

test("nextLoad: a normal set holds", () => {
  const r = nextLoad({ sets: sets([[8, "easy"], [8, "normal"], [8, "easy"]]), targetReps: 8, currentLoad: 90, steps: smithSteps });
  assert.equal(r.action, "hold");
});

test("nextLoad: any hard set holds", () => {
  const r = nextLoad({ sets: sets([[8, "easy"], [8, "hard"], [8, "easy"]]), targetReps: 8, currentLoad: 90, steps: smithSteps });
  assert.equal(r.action, "hold");
});

test("nextLoad: missed reps once holds, twice lowers one step", () => {
  const missed = sets([[8, "normal"], [6, "hard"], [5, "hard"]]);
  const once = nextLoad({ sets: missed, targetReps: 8, currentLoad: 90, steps: smithSteps, prevMissedReps: false });
  assert.equal(once.action, "hold");
  const twice = nextLoad({ sets: missed, targetReps: 8, currentLoad: 90, steps: smithSteps, prevMissedReps: true });
  assert.deepEqual({ action: twice.action, load: twice.load }, { action: "decrease", load: 85 });
});

test("nextLoad: warm-up sets never count against the verdict", () => {
  const withWarmup = sets([[5, "hard", true], [8, "easy"], [8, "easy"], [8, "easy"]]);
  const r = nextLoad({ sets: withWarmup, targetReps: 8, currentLoad: 90, steps: smithSteps });
  assert.equal(r.action, "increase");
});

test("nextLoad: at the gym's max, all-easy still holds", () => {
  const r = nextLoad({ sets: sets([[12, "easy"], [12, "easy"], [12, "easy"]]), targetReps: 12, currentLoad: 280, steps: inventorySteps(legPress, INVENTORY) });
  assert.deepEqual({ action: r.action, reason: r.reason }, { action: "hold", reason: "at-max" });
});

test("nextLoad: 'max' rep targets count as met", () => {
  const r = nextLoad({ sets: sets([[6, "easy"], [5, "easy"], [4, "easy"]]), targetReps: "max", currentLoad: 0, steps: [0] });
  assert.equal(r.reason, "at-max");
});

test("recoveryLoad: 83% of 90 lb snaps down to 70 on smith steps", () => {
  assert.equal(recoveryLoad(90, 0.83, smithSteps), 70);
});

test("recoveryLoad: dumbbell snaps down to an existing plate", () => {
  assert.equal(recoveryLoad(35, 0.83, inventorySteps(dumbbell, INVENTORY)), 27.5);
});

test("recoveryLoad: never below the smallest available step", () => {
  assert.equal(recoveryLoad(4, 0.83, inventorySteps(dumbbell, INVENTORY)), 5);
});

test("gap detection and recovery weeks", () => {
  assert.equal(gapDays("2026-07-20", "2026-08-03"), 14);
  assert.equal(shouldSuggestRecovery("2026-07-20", "2026-08-03", 14), true);
  assert.equal(shouldSuggestRecovery("2026-07-21", "2026-08-03", 14), false);
  assert.equal(shouldSuggestRecovery(null, "2026-08-03", 14), false);
  assert.equal(recoveryWeek("2026-08-03", "2026-08-03"), 1);
  assert.equal(recoveryWeek("2026-08-03", "2026-08-09"), 1);
  assert.equal(recoveryWeek("2026-08-03", "2026-08-10"), 2);
});

test("weekKey: Monday-start calendar week", () => {
  assert.equal(weekKey("2026-08-03"), "2026-08-03"); // a Monday maps to itself
  assert.equal(weekKey("2026-08-09"), "2026-08-03"); // Sunday belongs to the prior Monday
  assert.equal(weekKey("2026-08-02"), "2026-07-27"); // previous week's Sunday
});

test("weeklyBalance: aggregates variants by body part, weights only, working sets only", () => {
  const exercises = {
    "latpulldown-upright": { id: "latpulldown-upright", bodyPart: "back" },
    "latpulldown-45": { id: "latpulldown-45", bodyPart: "back" },
    "smith-squat": { id: "smith-squat", bodyPart: "legs" },
  };
  const mkSets = (n, warmups = 0) => [
    ...Array.from({ length: warmups }, () => ({ reps: 5, effort: "easy", warmup: true })),
    ...Array.from({ length: n }, () => ({ reps: 8, effort: "normal", warmup: false })),
  ];
  const sessions = [
    { kind: "weights", date: "2026-08-03", entries: [
      { exerciseId: "latpulldown-upright", sets: mkSets(3) },
      { exerciseId: "smith-squat", sets: mkSets(3, 2) },
    ]},
    { kind: "weights", date: "2026-08-05", entries: [
      { exerciseId: "latpulldown-45", sets: mkSets(3) },
    ]},
    { kind: "run", date: "2026-08-04", entries: [] },
    { kind: "weights", date: "2026-07-27", entries: [
      { exerciseId: "smith-squat", sets: mkSets(3) },
    ]},
  ];
  const totals = weeklyBalance(sessions, exercises, "2026-08-03");
  assert.deepEqual(totals, { back: 6, legs: 3 });
});

test("monthlyProgressPct and overshoot warning", () => {
  const history = [
    { date: "2026-05-22", load: 140 },
    { date: "2026-06-15", load: 140 },
    { date: "2026-06-26", load: 180 },
  ];
  const pct = monthlyProgressPct(history);
  assert.ok(Math.abs(pct - 28.57) < 0.1);
  assert.ok(overshootWarning(history));
  assert.equal(overshootWarning([{ date: "2026-06-20", load: 100 }, { date: "2026-06-26", load: 105 }]), null);
  assert.equal(monthlyProgressPct([]), null);
});

// ------------------------------------------------------- units / rest (A)

test("KG_PER_LB round-trip: lbToKg and kgToLb undo each other at raw precision", () => {
  assert.equal(KG_PER_LB, 0.45359237);
  const rawKg = lbToKg(90, { round: false });
  assert.ok(Math.abs(rawKg - 40.8233133) < 1e-6);
  const backToLb = kgToLb(rawKg, { round: false });
  assert.ok(Math.abs(backToLb - 90) < 1e-9);
});

test("lbToKg / kgToLb round to 0.1 for display by default", () => {
  assert.equal(lbToKg(90), 40.8);
  assert.equal(kgToLb(40.8), 89.9); // 40.8 kg is not exactly 90 lb; rounds down at 0.1
});

test("formatLoad: both mode shows original first, conversion in parentheses", () => {
  assert.equal(formatLoad(90, "lb", "both"), "90 lb (40.8 kg)");
  assert.equal(formatLoad(41, "kg", "both"), "41 kg (90.4 lb)");
});

test("formatLoad: single-unit mode converts when it differs from storedUnit", () => {
  assert.equal(formatLoad(90, "lb", "kg"), "40.8 kg");
  assert.equal(formatLoad(41, "kg", "lb"), "90.4 lb");
});

test("formatLoad: same-unit mode shows the plain value, no duplicate parentheses", () => {
  assert.equal(formatLoad(90, "lb", "lb"), "90 lb");
  assert.equal(formatLoad(41, "kg", "kg"), "41 kg");
});

test("parseLoadInput: both mode reads text in storedUnit directly", () => {
  assert.equal(parseLoadInput("92.5", "lb", "both"), 92.5);
});

test("parseLoadInput: single-unit mode converts typed value back to storedUnit", () => {
  // Typed 40.8 kg while stored in lb -> back to lb, rounded to 2 decimals.
  assert.equal(parseLoadInput("40.8", "lb", "kg"), 89.95);
  // Same unit: no conversion.
  assert.equal(parseLoadInput("100", "kg", "kg"), 100);
});

test("parseLoadInput: invalid text falls back to 0", () => {
  assert.equal(parseLoadInput("not-a-number", "lb", "both"), 0);
});

test("restSecondsFor: per-exercise override wins over the global default", () => {
  const settings = { restDefaultSec: 90, restOverrides: { "smith-squat": 150 } };
  assert.equal(restSecondsFor("smith-squat", settings), 150);
  assert.equal(restSecondsFor("ohp", settings), 90);
  assert.equal(restSecondsFor("ohp", { restOverrides: {} }), 90); // default fallback when restDefaultSec missing
});

// ---------------------------------------------- cardio / body comp (v1.1, B)

test("proteinTargetG: rounds weight x coefficient to whole grams", () => {
  assert.equal(proteinTargetG(75, 1.6), 120);
  assert.equal(proteinTargetG(74.6, 1.8), 134); // 134.28 -> 134
});

test("proteinCoefDisplay: kg mode shows g/kg, lb mode converts to g/lb", () => {
  assert.equal(proteinCoefDisplay(1.6, "kg"), "1.6 g/kg");
  assert.equal(proteinCoefDisplay(1.6, "lb"), "0.73 g/lb");
  assert.equal(proteinCoefDisplay(2.2, "kg"), "2.2 g/kg");
});

test("bodyweightDisplay: unit-aware, rounded to 0.1", () => {
  assert.equal(bodyweightDisplay(74.8, "kg"), "74.8 kg");
  assert.equal(bodyweightDisplay(74.8, "lb"), "164.9 lb");
});

test("leanMassKg: fat-free mass from weight and body fat percent", () => {
  assert.equal(leanMassKg(80, 20), 64);
  assert.equal(leanMassKg(80, null), null);
});

test("paceText: minutes/distance to pace string; null when either is missing or zero", () => {
  assert.equal(paceText(30, 4.5), "6'40\"/km");
  assert.equal(paceText(0, 5), null);
  assert.equal(paceText(30, 0), null);
  assert.equal(paceText(30, null), null);
  assert.equal(paceText(null, 5), null);
});

test("weeklyCardioMinutes: sums cardio-kind sessions in the given Monday-week only", () => {
  const sessions = [
    { kind: "cardio", date: "2026-08-03", cardio: { minutes: 30 } },
    { kind: "cardio", date: "2026-08-05", cardio: { minutes: 45 } },
    { kind: "weights", date: "2026-08-04", entries: [] },
    { kind: "cardio", date: "2026-07-27", cardio: { minutes: 20 } }, // prior week
  ];
  assert.equal(weeklyCardioMinutes(sessions, "2026-08-03"), 75);
  assert.equal(weeklyCardioMinutes(sessions, "2026-07-27"), 20);
});

// --------------------------------------------------------- methods (v1.1, C)

test("pyramidPlan: ladders down one step and up 2 reps per earlier set, last set = snapped target", () => {
  const plan = pyramidPlan(90, 8, 4, smithSteps);
  assert.equal(plan.length, 4);
  assert.deepEqual(plan[3], { load: 90, reps: 8 });
  assert.deepEqual(plan[2], { load: 85, reps: 10 });
  assert.deepEqual(plan[1], { load: 80, reps: 12 });
  assert.deepEqual(plan[0], { load: 75, reps: 14 });
});

test("pyramidPlan: snaps a non-step target load down for the top set", () => {
  const plan = pyramidPlan(92, 8, 2, smithSteps); // 92 is not on the smith ladder
  assert.equal(plan[1].load, 90); // snapped down to the nearest step
  assert.equal(plan[0].load, 85);
});

test("pyramidPlan: never steps below the smallest available step", () => {
  const dSteps = inventorySteps(dumbbell, INVENTORY);
  const plan = pyramidPlan(10, 6, 5, dSteps); // only 5 and 10 lie below 10 on this list
  // once stepDown runs out, the load holds at the smallest step instead of going lower
  assert.equal(plan[plan.length - 1].load, 10);
  assert.equal(plan[0].load, dSteps[0]);
});

test("pyramidPlan: reps cap at 20", () => {
  const plan = pyramidPlan(90, 19, 5, smithSteps);
  assert.ok(plan.every((p) => p.reps <= 20));
  assert.equal(plan[plan.length - 1].reps, 19);
});

test("pyramidPlan: 'max' rep target falls back to null (render as normal)", () => {
  assert.equal(pyramidPlan(90, "max", 4, smithSteps), null);
});

test("dropChain: next lower distinct steps below load, descending", () => {
  assert.deepEqual(dropChain(90, smithSteps, 2), [85, 80]);
});

test("dropChain: shorter near the bottom of the range", () => {
  const dSteps = inventorySteps(dumbbell, INVENTORY);
  assert.deepEqual(dropChain(dSteps[0], dSteps, 2), []); // already at the floor
  assert.deepEqual(dropChain(dSteps[1], dSteps, 2), [dSteps[0]]); // only one step below
});

test("dropChain: empty for bodyweight (single zero step)", () => {
  assert.deepEqual(dropChain(0, inventorySteps(pullUp, INVENTORY), 2), []);
});

test("nextLoad: a hard drop set is ignored for the verdict, same as warm-ups", () => {
  const withDrop = sets([[8, "easy"], [8, "easy"], [8, "easy"]]).concat([
    { weight: 60, reps: 12, effort: "hard", warmup: false, drop: true },
  ]);
  const r = nextLoad({ sets: withDrop, targetReps: 8, currentLoad: 90, steps: smithSteps });
  assert.equal(r.action, "increase");
});

test("emphasisBreakdown: counts working sets per emphasis label within body part, this week only", () => {
  const exercises = {
    "latpulldown-close": { id: "latpulldown-close", bodyPart: "back", emphasis: "광배근 하부" },
    "latpulldown-wide": { id: "latpulldown-wide", bodyPart: "back", emphasis: "광배근 상부" },
    "smith-squat": { id: "smith-squat", bodyPart: "legs" }, // no emphasis: excluded
  };
  const mkSets = (n, { warmups = 0, drops = 0 } = {}) => [
    ...Array.from({ length: warmups }, () => ({ reps: 5, effort: "easy", warmup: true })),
    ...Array.from({ length: n }, () => ({ reps: 8, effort: "normal", warmup: false })),
    ...Array.from({ length: drops }, () => ({ reps: 10, effort: "hard", warmup: false, drop: true })),
  ];
  const sessions = [
    { kind: "weights", date: "2026-08-03", entries: [
      { exerciseId: "latpulldown-close", sets: mkSets(3, { warmups: 1 }) },
      { exerciseId: "latpulldown-wide", sets: mkSets(3, { drops: 2 }) },
      { exerciseId: "smith-squat", sets: mkSets(3) },
    ]},
    { kind: "weights", date: "2026-07-27", entries: [
      { exerciseId: "latpulldown-close", sets: mkSets(5) }, // prior week: excluded
    ]},
  ];
  const totals = emphasisBreakdown(sessions, exercises, "2026-08-03");
  assert.deepEqual(totals, { back: { "광배근 하부": 3, "광배근 상부": 5 } });
});

// ------------------------------------------------- polish backlog (v1.1.1)

test("warmupDefaultLoad: 50% of target load snapped down to a smith step", () => {
  assert.equal(warmupDefaultLoad(90, smithSteps), 45); // 45 is itself a valid smith step
});

test("warmupDefaultLoad: snaps down when 50% doesn't land on a step", () => {
  assert.equal(warmupDefaultLoad(92, smithSteps), 45); // 46 -> snaps down to 45
});

test("warmupDefaultLoad: clamps at the smallest available step, never below it", () => {
  const dSteps = inventorySteps(dumbbell, INVENTORY); // smallest step is 5
  assert.equal(warmupDefaultLoad(3, dSteps), 5); // 50% = 1.5, below every step
});

test("warmupDefaultLoad: bodyweight (single zero step) and empty step lists collapse to 0", () => {
  assert.equal(warmupDefaultLoad(20, inventorySteps(pullUp, INVENTORY)), 0);
  assert.equal(warmupDefaultLoad(20, []), 0);
});

test("orderTrendExercises: current-program exercises first (program order), then remaining by recency", () => {
  const exercisesById = {
    "smith-squat": { id: "smith-squat", name: "Smith Squat" },
    "db-row": { id: "db-row", name: "DB Row" },
    "lat-pulldown": { id: "lat-pulldown", name: "Lat Pulldown" },
  };
  const programs = [
    { id: "p1", kind: "weights", items: [{ exerciseId: "db-row" }, { exerciseId: "smith-squat" }] },
  ];
  const sessions = [
    { kind: "weights", date: "2026-08-01", entries: [{ exerciseId: "smith-squat" }] },
    { kind: "weights", date: "2026-08-05", entries: [{ exerciseId: "lat-pulldown" }] },
    { kind: "weights", date: "2026-08-02", entries: [{ exerciseId: "db-row" }] },
  ];
  const order = orderTrendExercises(programs, sessions, exercisesById).map((e) => e.id);
  // db-row and smith-squat are in the current program (program item order),
  // both logged so both qualify; lat-pulldown is logged but not in any
  // program, so it falls into the "remaining by recency" bucket last.
  assert.deepEqual(order, ["db-row", "smith-squat", "lat-pulldown"]);
});

test("orderTrendExercises: exercises never logged are excluded even if in a program", () => {
  const exercisesById = { "smith-squat": { id: "smith-squat", name: "Smith Squat" } };
  const programs = [{ id: "p1", kind: "weights", items: [{ exerciseId: "never-logged" }, { exerciseId: "smith-squat" }] }];
  const sessions = [{ kind: "weights", date: "2026-08-01", entries: [{ exerciseId: "smith-squat" }] }];
  const order = orderTrendExercises(programs, sessions, exercisesById).map((e) => e.id);
  assert.deepEqual(order, ["smith-squat"]);
});

test("orderTrendExercises: orphaned (deleted) exercise ids stay as recency candidates with a placeholder", () => {
  const exercisesById = { "smith-squat": { id: "smith-squat", name: "Smith Squat" } };
  const sessions = [
    { kind: "weights", date: "2026-08-01", entries: [{ exerciseId: "smith-squat" }] },
    { kind: "weights", date: "2026-08-05", entries: [{ exerciseId: "gone-ex" }] },
  ];
  const order = orderTrendExercises([], sessions, exercisesById);
  assert.deepEqual(order.map((e) => e.id), ["gone-ex", "smith-squat"]);
  assert.equal(order[0].deleted, true);
});

test("weeklyBalance: a holdSec set (reps 0) still counts as a working set", () => {
  const exercises = { "wall-handstand-hold": { id: "wall-handstand-hold", bodyPart: "shoulders" } };
  const sessions = [
    { kind: "weights", date: "2026-08-03", entries: [
      { exerciseId: "wall-handstand-hold", sets: [
        { weight: 0, reps: 0, holdSec: 45, effort: null, warmup: false },
        { weight: 0, reps: 0, holdSec: 30, effort: null, warmup: false },
      ] },
    ]},
  ];
  const totals = weeklyBalance(sessions, exercises, "2026-08-03");
  assert.deepEqual(totals, { shoulders: 2 });
  assert.equal(workingSets(sessions[0].entries[0].sets).length, 2);
});
