// Guards for the recommendation module's load inference: the conservative
// contract (exact match reuses, family match reduces and snaps down,
// per-hand dumbbell never maps to stack/bar totals) must hold, because a
// wrong inference here writes a too-heavy starting load into a program.

import { test } from "node:test";
import assert from "node:assert/strict";

import { pairFactor, userLoadsByKey, inferCourseLoads, recommendInput, buildCourse } from "../js/recommend.js";
import { DEFAULT_SETTINGS } from "../js/store.js";

test("pairFactor: exact, same-family tiers, and forbidden cross-equipment pairs", () => {
  assert.equal(pairFactor("smith-bench", "smith-bench"), 1);
  // machine <-> cable within a family is allowed at 0.8
  assert.equal(pairFactor("seated-cable-row", "standing-cable-row"), 0.9); // cable <-> cable
  assert.equal(pairFactor("reverse-pec-deck", "face-pull"), 0.8); // machine <-> cable
  // per-hand dumbbell never maps onto stack/bar totals
  assert.equal(pairFactor("smith-bench", "incline-db-press"), 0);
  assert.equal(pairFactor("seated-cable-row", "db-row"), 0);
  // unrelated families never infer
  assert.equal(pairFactor("leg-curl", "smith-bench"), 0);
});

test("userLoadsByKey: alias resolution and kg to lb conversion", () => {
  const programs = [{
    kind: "weights",
    items: [
      { exerciseId: "db-ohp", targetLoad: 35 },              // alias -> overhead-press
      { exerciseId: "standing-cable-row", targetLoad: 50 },  // kg-stored exercise
      { exerciseId: "not-a-catalog-id", targetLoad: 99 },    // ignored
    ],
  }];
  const exercisesById = {
    "db-ohp": { id: "db-ohp", unit: "lb" },
    "standing-cable-row": { id: "standing-cable-row", unit: "kg" },
  };
  const loads = userLoadsByKey(programs, exercisesById);
  assert.equal(loads["overhead-press"], 35);
  assert.ok(Math.abs(loads["standing-cable-row"] - 110.23) < 0.1);
  assert.ok(!("not-a-catalog-id" in loads));
});

test("inferCourseLoads: fills exact and family matches, leaves bodyweight and unknown at 0", () => {
  const idPrefix = "t";
  const course = buildCourse(3, 60, idPrefix);
  const loads = { "smith-bench": 70, "standing-cable-row": 110, "lat-pulldown": 85 };
  const filled = inferCourseLoads(course, loads, DEFAULT_SETTINGS, idPrefix);
  assert.ok(filled > 0);
  const items = course.programs.flatMap((p) => p.items);
  const byKey = Object.fromEntries(items.map((i) => [i.exerciseId.slice(idPrefix.length + 1), i]));
  // exact: user's smith-bench load carried over (snapped within steps)
  assert.ok(byKey["smith-bench"].targetLoad > 0 && byKey["smith-bench"].targetLoad <= 70);
  // family (cable -> cable, 0.9): seated-cable-row inferred below the source
  if (byKey["seated-cable-row"]) {
    assert.ok(byKey["seated-cable-row"].targetLoad > 0 && byKey["seated-cable-row"].targetLoad <= 110 * 0.9);
  }
  // bodyweight work never gets a load
  for (const [key, item] of Object.entries(byKey)) {
    if (["pull-up", "dips", "crunch", "plank"].includes(key)) assert.equal(item.targetLoad, 0);
  }
});

test("recommendInput: sparse history falls back, dense history derives days and minutes", () => {
  const sparse = recommendInput([], new Date("2026-08-15T12:00:00"));
  assert.deepEqual(sparse, { days: 3, minutes: 60, hasHistory: false });

  const mk = (date, minutes) => ({
    kind: "weights", date,
    startedAt: Date.parse(date + "T10:00:00"),
    endedAt: Date.parse(date + "T10:00:00") + minutes * 60000,
  });
  const sessions = [
    mk("2026-07-20", 62), mk("2026-07-22", 55), mk("2026-07-24", 65),
    mk("2026-07-27", 58), mk("2026-07-29", 61), mk("2026-07-31", 63),
    mk("2026-08-03", 60), mk("2026-08-05", 59), mk("2026-08-07", 64),
    mk("2026-08-10", 57), mk("2026-08-12", 62), mk("2026-08-14", 60),
  ];
  const dense = recommendInput(sessions, new Date("2026-08-15T12:00:00"));
  assert.equal(dense.hasHistory, true);
  assert.equal(dense.days, 3);
  assert.equal(dense.minutes, 60);
});
