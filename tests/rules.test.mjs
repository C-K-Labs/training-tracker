import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inventorySteps, snapDown, stepUp, stepDown,
  nextLoad, recoveryLoad,
  gapDays, shouldSuggestRecovery, recoveryWeek,
  weekKey, weeklyBalance,
  monthlyProgressPct, overshootWarning,
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
