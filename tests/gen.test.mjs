import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCourse, volumeReport, BANDS, CATALOG, effectiveBand } from "../js/gen.js";

const GOALS = ["strength", "hypertrophy", "fatloss", "fitness"];
const EQUIPMENT = ["gym", "home_dumbbell", "bodyweight"];
const ALLOWED_EQUIPMENT = {
  gym: new Set(["machine", "cable", "smith", "dumbbell", "bodyweight"]),
  home_dumbbell: new Set(["dumbbell", "bodyweight"]),
  bodyweight: new Set(["bodyweight"]),
};

// Recovers the catalog key from a generated exercise's i18nKey ("exname.key"),
// independent of idPrefix (which may itself contain dashes).
function catalogKeyOf(ex) {
  return ex.i18nKey.replace(/^exname\./, "");
}

function exercisesById(course) {
  const map = {};
  for (const ex of course.exercises) map[ex.id] = ex;
  return map;
}

// ---------------------------------------------------------- shared checks

function assertDeterministicIds(course, idPrefix) {
  for (const ex of course.exercises) {
    assert.ok(ex.id.startsWith(`${idPrefix}-`), `exercise id ${ex.id} should start with ${idPrefix}-`);
    assert.equal(ex.id, `${idPrefix}-${catalogKeyOf(ex)}`);
  }
  course.programs.forEach((p, i) => {
    assert.equal(p.id, `${idPrefix}-s${i + 1}`);
  });
}

function assertItemsResolveToExercises(course) {
  const byId = exercisesById(course);
  for (const program of course.programs) {
    for (const item of program.items) {
      assert.ok(byId[item.exerciseId], `program ${program.id} references missing exercise ${item.exerciseId}`);
    }
  }
}

function assertNoExerciseOutsideTier(course, equipment) {
  const allowed = ALLOWED_EQUIPMENT[equipment];
  for (const ex of course.exercises) {
    assert.ok(allowed.has(ex.equipment), `${ex.id} (${ex.equipment}) is outside the ${equipment} tier`);
  }
}

// days defaults to a value that never triggers the 2-day clamp, so existing
// call sites that don't pass it keep checking the plain per-experience BANDS.
function assertVolumeBands(course, experience, days = 3) {
  const [lo, hi] = effectiveBand(experience, days);
  const report = volumeReport(course);
  const majorParts = ["legs", "back", "chest", "shoulders", "arms"];
  for (const part of majorParts) {
    const total = report[part] || 0;
    assert.ok(
      total >= lo && total <= hi,
      `${part} weekly sets ${total} outside ${experience}/${days}-day band [${lo}, ${hi}]`,
    );
  }
}

// Body-part session coverage: how many of the week's sessions contain at
// least one exercise of the given body part.
function sessionCoverage(course) {
  const byId = exercisesById(course);
  const coverage = {};
  for (const program of course.programs) {
    const partsInSession = new Set();
    for (const item of program.items) {
      const ex = byId[item.exerciseId];
      if (ex) partsInSession.add(ex.bodyPart);
    }
    for (const part of partsInSession) coverage[part] = (coverage[part] || 0) + 1;
  }
  return coverage;
}

// Main compound lifts should appear 2x/week whenever the split allows it:
// at least one compound catalog key must occur in 2+ distinct sessions.
function assertMainLiftsTwicePerWeek(course) {
  const byId = exercisesById(course);
  const counts = {};
  for (const program of course.programs) {
    const seenInThisProgram = new Set();
    for (const item of program.items) {
      const ex = byId[item.exerciseId];
      const key = catalogKeyOf(ex);
      if (!CATALOG[key].compound) continue;
      if (seenInThisProgram.has(key)) continue;
      seenInThisProgram.add(key);
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const anyTwice = Object.values(counts).some((n) => n >= 2);
  assert.ok(anyTwice, "expected at least one compound lift to appear in 2+ sessions");
}

// ---------------------------------------------------------- grid: every goal, 3 days, gym, intermediate

for (const goal of GOALS) {
  test(`gen: goal=${goal} 3-day gym intermediate`, () => {
    const idPrefix = `t-${goal}`;
    const course = generateCourse(
      { goal, daysPerWeek: 3, experience: "intermediate", equipment: "gym", sessionMinutes: 60 },
      { idPrefix },
    );
    assert.equal(course.programs.length, 3);
    assert.deepEqual(course.programs.map((p) => p.name), ["전신 A", "전신 B", "전신 C"]);
    assertDeterministicIds(course, idPrefix);
    assertItemsResolveToExercises(course);
    assertNoExerciseOutsideTier(course, "gym");
    assertVolumeBands(course, "intermediate");
    assertMainLiftsTwicePerWeek(course);

    if (goal === "fatloss") {
      assert.ok(course.notes.includes("onboarding.note.cardio"));
      // At least one session should have a superset pair among its items.
      const hasSuperset = course.programs.some((p) => p.items.some((i) => i.method === "superset"));
      assert.ok(hasSuperset, "fatloss course should use superset pairing");
    } else {
      assert.ok(!course.notes.includes("onboarding.note.cardio"));
      for (const p of course.programs) {
        assert.ok(!p.items.some((i) => i.method === "superset"), `${goal} should not use superset`);
      }
    }
  });
}

// ---------------------------------------------------------- grid: days 2/4/5/6, hypertrophy, gym, intermediate

const EXPECTED_NAMES = {
  2: ["전신 A", "전신 B"],
  4: ["상체 A", "하체 A", "상체 B", "하체 B"],
  5: ["푸시", "풀", "레그", "상체", "하체"],
  6: ["푸시 A", "풀 A", "레그 A", "푸시 B", "풀 B", "레그 B"],
};

for (const days of [2, 4, 5, 6]) {
  test(`gen: hypertrophy gym intermediate, ${days} days/week`, () => {
    const idPrefix = `t-d${days}`;
    const course = generateCourse(
      { goal: "hypertrophy", daysPerWeek: days, experience: "intermediate", equipment: "gym", sessionMinutes: 60 },
      { idPrefix },
    );
    assert.equal(course.programs.length, days);
    assert.deepEqual(course.programs.map((p) => p.name), EXPECTED_NAMES[days]);
    assertDeterministicIds(course, idPrefix);
    assertItemsResolveToExercises(course);
    assertNoExerciseOutsideTier(course, "gym");
    assertVolumeBands(course, "intermediate", days);
    if (days >= 3) assertMainLiftsTwicePerWeek(course);
  });
}

// Days=2 clamps the target band to 10-14 regardless of experience: verify
// the clamp actually differs from the plain per-experience BANDS table.
test("gen: effectiveBand clamps to 10-14 on a 2-day split for every experience", () => {
  for (const experience of ["beginner", "intermediate", "advanced"]) {
    assert.deepEqual(effectiveBand(experience, 2), [10, 14]);
  }
  assert.deepEqual(effectiveBand("intermediate", 3), BANDS.intermediate);
});

test("gen: 2-day course notes include the two-day volume-cap explanation", () => {
  const course = generateCourse(
    { goal: "hypertrophy", daysPerWeek: 2, experience: "advanced", equipment: "gym", sessionMinutes: 60 },
    { idPrefix: "t-2day-note" },
  );
  assert.ok(course.notes.includes("onboarding.note.twoDayCap"));
});

// C3 evidence anchor: "main lifts 2x/week whenever the split allows" --
// at days=5 (Push/Pull/Legs/Upper/Lower) every major body part is trained
// in at least 2 of the 5 sessions (legs via Legs+Lower, chest/shoulders via
// Push+Upper, back via Pull+Upper), not just whichever single compound
// happens to repeat.
test("gen: days=5 trains every major body part in at least 2 sessions/week", () => {
  const course = generateCourse(
    { goal: "hypertrophy", daysPerWeek: 5, experience: "intermediate", equipment: "gym", sessionMinutes: 60 },
    { idPrefix: "t-d5-coverage" },
  );
  const coverage = sessionCoverage(course);
  for (const part of ["legs", "back", "chest", "shoulders"]) {
    assert.ok((coverage[part] || 0) >= 2, `${part} only appears in ${coverage[part] || 0} of 5 sessions`);
  }
});

// ---------------------------------------------------------- grid: every equipment, 3 days, beginner

for (const equipment of EQUIPMENT) {
  test(`gen: hypertrophy 3-day beginner, equipment=${equipment}`, () => {
    const idPrefix = `t-${equipment}`;
    const course = generateCourse(
      { goal: "hypertrophy", daysPerWeek: 3, experience: "beginner", equipment, sessionMinutes: 60 },
      { idPrefix },
    );
    assertDeterministicIds(course, idPrefix);
    assertItemsResolveToExercises(course);
    assertNoExerciseOutsideTier(course, equipment);
    assertVolumeBands(course, "beginner");
    assertMainLiftsTwicePerWeek(course);
  });
}

// ---------------------------------------------------------- sessionMinutes 30 vs 90

test("gen: sessionMinutes 30 yields fewer items than 90 (floor 4, cap 9)", () => {
  const short = generateCourse(
    { goal: "hypertrophy", daysPerWeek: 3, experience: "intermediate", equipment: "gym", sessionMinutes: 30 },
    { idPrefix: "t-short" },
  );
  const long = generateCourse(
    { goal: "hypertrophy", daysPerWeek: 3, experience: "intermediate", equipment: "gym", sessionMinutes: 90 },
    { idPrefix: "t-long" },
  );
  for (const p of short.programs) {
    assert.ok(p.items.length >= 4, `${p.id} has fewer than the floor of 4 items`);
    assert.ok(p.items.length <= 9, `${p.id} exceeds the cap of 9 items`);
  }
  for (const p of long.programs) {
    assert.ok(p.items.length >= 4);
    assert.ok(p.items.length <= 9);
  }
  const shortTotal = short.programs.reduce((sum, p) => sum + p.items.length, 0);
  const longTotal = long.programs.reduce((sum, p) => sum + p.items.length, 0);
  assert.ok(longTotal > shortTotal, "90-minute sessions should pack in more items than 30-minute sessions");

  assertItemsResolveToExercises(short);
  assertItemsResolveToExercises(long);
  assertVolumeBands(short, "intermediate");
  assertVolumeBands(long, "intermediate");
});

// ---------------------------------------------------------- deterministic across repeated calls

test("gen: identical input + idPrefix produces identical output", () => {
  const input = { goal: "strength", daysPerWeek: 4, experience: "advanced", equipment: "home_dumbbell", sessionMinutes: 45 };
  const a = generateCourse(input, { idPrefix: "same" });
  const b = generateCourse(input, { idPrefix: "same" });
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------- reps by goal / max reps override

test("gen: strength goal uses 3-6 rep compounds, no max-rep override", () => {
  const course = generateCourse(
    { goal: "strength", daysPerWeek: 3, experience: "intermediate", equipment: "gym", sessionMinutes: 60 },
    { idPrefix: "t-strength-reps" },
  );
  const byId = exercisesById(course);
  for (const program of course.programs) {
    for (const item of program.items) {
      const ex = byId[item.exerciseId];
      const key = catalogKeyOf(ex);
      if (CATALOG[key].compound) {
        assert.notEqual(item.reps, "max");
        assert.ok(item.reps >= 3 && item.reps <= 6, `${key} strength reps ${item.reps} outside 3-6`);
      }
    }
  }
});

test("gen: hypertrophy goal gives pull-up/dips/pushup max reps", () => {
  const course = generateCourse(
    { goal: "hypertrophy", daysPerWeek: 3, experience: "intermediate", equipment: "bodyweight", sessionMinutes: 60 },
    { idPrefix: "t-hyper-bw" },
  );
  const byId = exercisesById(course);
  let sawOne = false;
  for (const program of course.programs) {
    for (const item of program.items) {
      const ex = byId[item.exerciseId];
      const key = catalogKeyOf(ex);
      if (["pull-up", "dips", "pushup"].includes(key)) {
        sawOne = true;
        assert.equal(item.reps, "max");
      }
    }
  }
  assert.ok(sawOne, "expected at least one of pull-up/dips/pushup in a bodyweight course");
});

// ---------------------------------------------------------- rest overrides (evidence: compounds 150-180s)

test("gen: restOverrides only covers compound exercises, within 150-180s", () => {
  const course = generateCourse(
    { goal: "hypertrophy", daysPerWeek: 3, experience: "intermediate", equipment: "gym", sessionMinutes: 60 },
    { idPrefix: "t-rest" },
  );
  const byId = exercisesById(course);
  for (const [exerciseId, seconds] of Object.entries(course.restOverrides)) {
    assert.ok(seconds >= 150 && seconds <= 180);
    const ex = byId[exerciseId];
    assert.ok(ex, `restOverrides references missing exercise ${exerciseId}`);
    assert.ok(CATALOG[catalogKeyOf(ex)].compound);
  }
});

// ---------------------------------------------------------- warmup on first compound only

test("gen: warmupSets set only on the first compound item of each session", () => {
  const course = generateCourse(
    { goal: "hypertrophy", daysPerWeek: 4, experience: "intermediate", equipment: "gym", sessionMinutes: 60 },
    { idPrefix: "t-warmup" },
  );
  const byId = exercisesById(course);
  for (const program of course.programs) {
    let warmupCount = 0;
    for (const item of program.items) {
      if (item.warmupSets > 0) warmupCount += 1;
    }
    assert.equal(warmupCount, 1, `${program.id} should have exactly one warm-up-bearing item`);
    const first = program.items.find((i) => i.warmupSets > 0);
    assert.ok(CATALOG[catalogKeyOf(byId[first.exerciseId])].compound);
  }
});
