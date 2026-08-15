// Rule-based course generator (v1.1, C3). Pure functions only: no DOM, no
// storage, no Date.now()/Math.random() in here so node --test can cover every
// branch deterministically. The caller (js/onboarding.js) supplies opts.idPrefix
// (built OUTSIDE this file, e.g. `gen-${Date.now().toString(36)}`) so ids stay
// reproducible for a given prefix.
//
// Evidence anchors encoded below (verified against NSCA/ACSM + Stronger by
// Science / Renaissance Periodization volume-landmark literature, same bar as
// js/rules.js's own citations):
//   - Weekly volume: 10-20 working sets per body part per week; beginners at
//     the low end (10-12), intermediate 12-16, advanced 16-20. -> BANDS below,
//     enforced by adjustVolume()/volumeReport() (clamped to 10-14 on a 2-day
//     split regardless of experience -- see effectiveBand()).
//   - Main compound lifts appear 2x/week whenever the split allows (frequency
//     effect on strength/hypertrophy, comparable volume split across more
//     sessions per week outperforms 1x/week). -> session templates reuse the
//     SAME resolved compound per slot across every occurrence of a split day
//     (full-body hits it every session; upper/lower and PPL hit it on each of
//     that day-type's occurrences), so it naturally recurs 2+ times whenever
//     daysPerWeek allows more than one occurrence of a given day type.
//   - Rep ranges by goal: strength 3-6 (compounds), hypertrophy 8-15,
//     fat-loss/fitness 10-15 (+ a cardio recommendation note since resistance
//     work alone under-delivers the energy-expenditure side of a fat-loss
//     goal). -> REPS_BY_GOAL.
//   - Rest: compounds 150-180s, isolation the app's 90s default. -> the
//     `restOverrides` output field (compound exerciseIds -> 165s, the
//     midpoint of 150-180) that the caller merges into settings.restOverrides;
//     isolation exercises are left out so restSecondsFor() falls back to the
//     90s global default (js/rules.js).

// ------------------------------------------------------------- equipment tiers
//
// "gym"           -> machines + cables + smith + dumbbells + bodyweight
// "home_dumbbell" -> dumbbells + bodyweight
// "bodyweight"    -> bodyweight only
// (Plain "barbell" is intentionally never used by the catalog: the approved
// tier definitions don't list it, only "smith" for barbell-pattern lifts.)
const ALLOWED_EQUIPMENT = {
  gym: new Set(["machine", "cable", "smith", "dumbbell", "bodyweight"]),
  home_dumbbell: new Set(["dumbbell", "bodyweight"]),
  bodyweight: new Set(["bodyweight"]),
};

// ------------------------------------------------------------------ catalog
//
// Korean names are the canonical real gym terms used elsewhere in this app
// (training-program-reference.md / exports/program-pack.json). i18nKey feeds
// Group E's en/es/pt dictionary fill later.
//
// v1.5.0: the catalog is also the single source for the seeded exercise
// library (js/seed.js derives DEFAULT_EXERCISES from it). Entries that appear
// in no session template below (e.g. sumo-deadlift, face-pull) are
// library-only: the generator never picks them, so adding one cannot change
// generated courses. "barbell" equipment is likewise library-only; no
// equipment tier allows it, so pickCandidate() can never select it.
export const CATALOG = {
  // ---- legs ----
  "smith-squat": { nameKo: "스미스 스쿼트", bodyPart: "legs", equipment: "smith", compound: true, spinalLoad: true, i18nKey: "exname.smith-squat" },
  "goblet-squat": { nameKo: "고블릿 스쿼트", bodyPart: "legs", equipment: "dumbbell", compound: true, i18nKey: "exname.goblet-squat" },
  "bodyweight-squat": { nameKo: "스쿼트 (맨몸)", bodyPart: "legs", equipment: "bodyweight", compound: true, i18nKey: "exname.bodyweight-squat" },
  "rdl": { nameKo: "루마니안 데드리프트", bodyPart: "legs", equipment: "dumbbell", compound: true, spinalLoad: true, i18nKey: "exname.rdl" },
  "glute-bridge-bw": { nameKo: "글루트 브릿지", bodyPart: "legs", equipment: "bodyweight", compound: false, i18nKey: "exname.glute-bridge-bw" },
  // Unilateral accessory work: real multi-joint movements, but treated as
  // adjustable/isolation-tier for THIS generator's volume budgeting (see
  // adjustVolume) so a leg day isn't locked into 3 fixed-volume compound
  // slots at once (squat + hinge + unilateral would alone blow past the
  // 10-20 sets/week band before any isolation adjustment even runs).
  "bulgarian-split-squat": { nameKo: "불가리안 스플릿 스쿼트", bodyPart: "legs", equipment: "dumbbell", compound: false, i18nKey: "exname.bulgarian-split-squat" },
  "lunge-bw": { nameKo: "런지", bodyPart: "legs", equipment: "bodyweight", compound: false, i18nKey: "exname.lunge-bw" },
  "leg-curl": { nameKo: "레그컬", bodyPart: "legs", equipment: "machine", compound: false, i18nKey: "exname.leg-curl" },
  "leg-extension": { nameKo: "레그 익스텐션", bodyPart: "legs", equipment: "machine", compound: false, i18nKey: "exname.leg-extension" },
  "calf-raise": { nameKo: "카프 레이즈", bodyPart: "legs", equipment: "machine", compound: false, i18nKey: "exname.calf-raise" },
  "calf-raise-db": { nameKo: "카프 레이즈 (덤벨)", bodyPart: "legs", equipment: "dumbbell", compound: false, i18nKey: "exname.calf-raise-db" },
  "calf-raise-bw": { nameKo: "카프 레이즈 (맨몸)", bodyPart: "legs", equipment: "bodyweight", compound: false, i18nKey: "exname.calf-raise-bw" },
  "leg-press": { nameKo: "레그프레스", bodyPart: "legs", equipment: "machine", compound: true, i18nKey: "exname.leg-press" },
  "sumo-deadlift": { nameKo: "스모 데드리프트", bodyPart: "legs", equipment: "barbell", compound: true, spinalLoad: true, i18nKey: "exname.sumo-deadlift" },
  "hip-thrust": { nameKo: "힙 쓰러스트", bodyPart: "legs", equipment: "machine", compound: true, i18nKey: "exname.hip-thrust" },

  // ---- back ----
  "lat-pulldown": { nameKo: "랫풀다운", bodyPart: "back", equipment: "cable", compound: true, i18nKey: "exname.lat-pulldown" },
  "db-row": { nameKo: "덤벨 로우", bodyPart: "back", equipment: "dumbbell", compound: true, i18nKey: "exname.db-row" },
  "pull-up": { nameKo: "턱걸이", bodyPart: "back", equipment: "bodyweight", compound: true, i18nKey: "exname.pull-up" },
  "inverted-row": { nameKo: "인버티드 로우", bodyPart: "back", equipment: "bodyweight", compound: false, i18nKey: "exname.inverted-row" },
  "seated-cable-row": { nameKo: "시티드 케이블 로우", bodyPart: "back", equipment: "cable", compound: false, i18nKey: "exname.seated-cable-row" },
  "smith-barbell-row": { nameKo: "스미스 바벨로우", bodyPart: "back", equipment: "smith", compound: true, spinalLoad: true, i18nKey: "exname.smith-barbell-row" },
  "standing-cable-row": { nameKo: "스탠딩 케이블로우", bodyPart: "back", equipment: "cable", compound: false, spinalLoad: true, i18nKey: "exname.standing-cable-row" },
  "db-shrug": { nameKo: "덤벨 슈러그", bodyPart: "back", equipment: "dumbbell", compound: false, i18nKey: "exname.db-shrug" },

  // ---- chest ----
  "smith-bench": { nameKo: "벤치프레스", bodyPart: "chest", equipment: "smith", compound: true, i18nKey: "exname.smith-bench" },
  "incline-db-press": { nameKo: "인클라인 덤벨프레스", bodyPart: "chest", equipment: "dumbbell", compound: true, i18nKey: "exname.incline-db-press" },
  // Real compound (multi-joint) bodyweight lifts, but the generator marks
  // them adjustable (compound:false, same rationale as the leg unilateral
  // note above) so a chest day isn't locked into two unremovable protected
  // slots at once; MAX_REPS_KEYS below still gives them "max" reps
  // independent of this flag.
  "pushup": { nameKo: "푸시업", bodyPart: "chest", equipment: "bodyweight", compound: false, i18nKey: "exname.pushup" },
  "dips": { nameKo: "딥스", bodyPart: "chest", equipment: "bodyweight", compound: false, i18nKey: "exname.dips" },
  "pec-deck-fly": { nameKo: "펙덱 플라이", bodyPart: "chest", equipment: "machine", compound: false, i18nKey: "exname.pec-deck-fly" },
  "db-fly": { nameKo: "덤벨 플라이", bodyPart: "chest", equipment: "dumbbell", compound: false, i18nKey: "exname.db-fly" },

  // ---- shoulders ----
  "overhead-press": { nameKo: "오버헤드프레스", bodyPart: "shoulders", equipment: "dumbbell", compound: true, i18nKey: "exname.overhead-press" },
  "pike-pushup": { nameKo: "파이크 푸시업", bodyPart: "shoulders", equipment: "bodyweight", compound: true, i18nKey: "exname.pike-pushup" },
  "lateral-raise": { nameKo: "레터럴 레이즈", bodyPart: "shoulders", equipment: "dumbbell", compound: false, i18nKey: "exname.lateral-raise" },
  "reverse-fly-db": { nameKo: "리버스 플라이 (덤벨)", bodyPart: "shoulders", equipment: "dumbbell", compound: false, i18nKey: "exname.reverse-fly-db" },
  "reverse-pec-deck": { nameKo: "리버스 펙덱", bodyPart: "shoulders", equipment: "machine", compound: false, i18nKey: "exname.reverse-pec-deck" },
  "wall-handstand-hold": { nameKo: "월 핸드스탠드 홀드", bodyPart: "shoulders", equipment: "bodyweight", compound: false, i18nKey: "exname.wall-handstand-hold" },
  "front-raise": { nameKo: "프런트 레이즈", bodyPart: "shoulders", equipment: "dumbbell", compound: false, i18nKey: "exname.front-raise" },
  "face-pull": { nameKo: "페이스풀", bodyPart: "shoulders", equipment: "cable", compound: false, i18nKey: "exname.face-pull" },

  // ---- arms ----
  "db-curl": { nameKo: "덤벨 컬", bodyPart: "arms", equipment: "dumbbell", compound: false, i18nKey: "exname.db-curl" },
  "triceps-pushdown": { nameKo: "트라이셉스 푸시다운", bodyPart: "arms", equipment: "cable", compound: false, i18nKey: "exname.triceps-pushdown" },
  "overhead-triceps-ext": { nameKo: "오버헤드 트라이셉스 익스텐션", bodyPart: "arms", equipment: "dumbbell", compound: false, i18nKey: "exname.overhead-triceps-ext" },
  "diamond-pushup": { nameKo: "다이아몬드 푸시업", bodyPart: "arms", equipment: "bodyweight", compound: false, i18nKey: "exname.diamond-pushup" },
  "chin-up-bw": { nameKo: "친업", bodyPart: "arms", equipment: "bodyweight", compound: false, i18nKey: "exname.chin-up-bw" },
  "hammer-curl": { nameKo: "해머컬", bodyPart: "arms", equipment: "dumbbell", compound: false, i18nKey: "exname.hammer-curl" },

  // ---- core ----
  "crunch": { nameKo: "크런치", bodyPart: "core", equipment: "bodyweight", compound: false, i18nKey: "exname.crunch" },
  "plank": { nameKo: "플랭크", bodyPart: "core", equipment: "bodyweight", compound: false, i18nKey: "exname.plank" },
  "hanging-leg-raise": { nameKo: "행잉 레그레이즈", bodyPart: "core", equipment: "bodyweight", compound: false, i18nKey: "exname.hanging-leg-raise" },

  // ---- calisthenics skill work (v1.12.0) ----
  // Library + skill-goal programs (js/skills.js) only: deliberately NOT in
  // the day templates above, so generated gym courses are unchanged.
  // planche-lean / tuck-planche / l-sit ids match the personal-pack ids that
  // already exist in the wild (v1.8.0 backfill), so syncLibrary's id-merge
  // never duplicates them.
  "planche-lean": { nameKo: "플란치 린", bodyPart: "shoulders", equipment: "bodyweight", compound: false, i18nKey: "exname.planche-lean" },
  "tuck-planche": { nameKo: "턱 플란치", bodyPart: "shoulders", equipment: "bodyweight", compound: false, i18nKey: "exname.tuck-planche" },
  "l-sit": { nameKo: "L싯", bodyPart: "core", equipment: "bodyweight", compound: false, i18nKey: "exname.l-sit" },
  "pseudo-planche-pushup": { nameKo: "슈도 플란치 푸시업", bodyPart: "shoulders", equipment: "bodyweight", compound: false, i18nKey: "exname.pseudo-planche-pushup" },
  "high-pullup": { nameKo: "하이 풀업", bodyPart: "back", equipment: "bodyweight", compound: true, i18nKey: "exname.high-pullup" },
  "mu-negative": { nameKo: "머슬업 네거티브", bodyPart: "back", equipment: "bodyweight", compound: true, i18nKey: "exname.mu-negative" },
  "tuck-front-lever": { nameKo: "턱 프론트레버", bodyPart: "back", equipment: "bodyweight", compound: false, i18nKey: "exname.tuck-front-lever" },
  "wall-handstand-pushup": { nameKo: "월 핸드스탠드 푸시업", bodyPart: "shoulders", equipment: "bodyweight", compound: true, i18nKey: "exname.wall-handstand-pushup" },
};

export function loadConventionFor(equipment) {
  if (equipment === "dumbbell") return "per-hand";
  if (equipment === "smith" || equipment === "barbell") return "excludes-bar";
  if (equipment === "bodyweight") return "bodyweight";
  return "stack"; // machine, cable
}

// ------------------------------------------------------------- day templates
//
// Each slot is a priority-ordered candidate list; the first candidate whose
// equipment fits the chosen tier (and isn't already used earlier in the SAME
// session) wins. Compounds are listed first in every template so the
// budget/floor/cap selection below naturally keeps compounds over isolation
// when a session is short.
const FULL_SLOTS = [
  ["smith-squat", "goblet-squat", "bodyweight-squat"],
  ["lat-pulldown", "db-row", "pull-up"],
  ["smith-bench", "incline-db-press", "pushup"],
  ["dips", "pushup"],
  ["overhead-press", "pike-pushup"],
  ["leg-curl", "bulgarian-split-squat", "glute-bridge-bw"],
  ["seated-cable-row", "inverted-row"],
  ["triceps-pushdown", "overhead-triceps-ext", "diamond-pushup"],
  ["lateral-raise", "reverse-fly-db", "wall-handstand-hold"],
  ["crunch"],
];

const UPPER_SLOTS = [
  ["smith-bench", "incline-db-press", "pushup"],
  ["lat-pulldown", "db-row", "pull-up"],
  ["overhead-press", "pike-pushup"],
  ["seated-cable-row", "inverted-row"],
  ["pec-deck-fly", "db-fly"],
  ["lateral-raise", "reverse-fly-db", "wall-handstand-hold"],
  ["db-curl"],
  ["triceps-pushdown", "overhead-triceps-ext", "diamond-pushup"],
  ["crunch"],
];

const LOWER_SLOTS = [
  ["smith-squat", "goblet-squat", "bodyweight-squat"],
  ["rdl", "glute-bridge-bw"],
  ["bulgarian-split-squat", "lunge-bw"],
  ["leg-curl"],
  ["leg-extension"],
  ["calf-raise", "calf-raise-db", "calf-raise-bw"],
  ["plank"],
  ["hanging-leg-raise", "crunch"],
];

const PUSH_SLOTS = [
  ["smith-bench", "incline-db-press", "pushup"],
  ["overhead-press", "pike-pushup"],
  ["dips", "pushup"],
  ["lateral-raise", "reverse-fly-db", "wall-handstand-hold"],
  ["pec-deck-fly", "db-fly"],
  ["triceps-pushdown", "overhead-triceps-ext", "diamond-pushup"],
  ["reverse-pec-deck"],
  ["crunch"],
];

const PULL_SLOTS = [
  ["lat-pulldown", "db-row", "pull-up"],
  ["pull-up", "inverted-row"],
  ["seated-cable-row", "inverted-row"],
  ["reverse-pec-deck", "reverse-fly-db"],
  ["db-curl", "chin-up-bw"],
  ["plank"],
];

const TEMPLATES = {
  full: FULL_SLOTS,
  upper: UPPER_SLOTS,
  lower: LOWER_SLOTS,
  push: PUSH_SLOTS,
  pull: PULL_SLOTS,
  legs: LOWER_SLOTS,
};

// Extra candidates the volume-adjustment pass can reach for even when the
// original session template didn't include that body part's slot.
const ISOLATION_CANDIDATES = {
  legs: ["leg-curl", "leg-extension", "calf-raise", "calf-raise-db", "calf-raise-bw", "glute-bridge-bw"],
  back: ["seated-cable-row", "inverted-row", "reverse-pec-deck"],
  chest: ["pec-deck-fly", "db-fly", "dips"],
  shoulders: ["lateral-raise", "reverse-fly-db", "reverse-pec-deck", "wall-handstand-hold"],
  arms: ["db-curl", "triceps-pushdown", "overhead-triceps-ext", "diamond-pushup", "chin-up-bw"],
};

// Splits by daysPerWeek (evidence anchor: 2-3 -> full-body A/B(/C); 4 ->
// upper/lower x2; 5 -> Push/Pull/Legs/Upper/Lower so EVERY major body part
// still lands 2x/week (legs via Legs+Lower, chest/shoulders via Push+Upper,
// back via Pull+Upper) -- a plain 2x-repeated PPL (Push/Pull/Legs/Push/Pull)
// would leave legs at 1x/week on a split that clearly allows 2x, which is
// exactly what the "whenever the split allows" evidence anchor rules out;
// 6 -> a full second push/pull/legs cycle so every main lift lands 2x/week.
// Each entry is [dayType, sessionName].
const SPLIT_BY_DAYS = {
  2: [["full", "전신 A"], ["full", "전신 B"]],
  3: [["full", "전신 A"], ["full", "전신 B"], ["full", "전신 C"]],
  4: [["upper", "상체 A"], ["lower", "하체 A"], ["upper", "상체 B"], ["lower", "하체 B"]],
  5: [["push", "푸시"], ["pull", "풀"], ["legs", "레그"], ["upper", "상체"], ["lower", "하체"]],
  6: [["push", "푸시 A"], ["pull", "풀 A"], ["legs", "레그 A"], ["push", "푸시 B"], ["pull", "풀 B"], ["legs", "레그 B"]],
};

// Weekly working-set band per body part per experience level (evidence
// anchor: 10-20 sets/part/week; beginner low end, intermediate mid,
// advanced high end).
export const BANDS = {
  beginner: [10, 12],
  intermediate: [12, 16],
  advanced: [16, 20],
};

const MAJOR_PARTS = ["legs", "back", "chest", "shoulders", "arms"];

// Rep ranges by goal (evidence anchor above). Isolation ranges for
// strength are not part of the cited 3-6 compound anchor; they're a plain
// accessory-work default kept inside the same rough "moderate" zone.
const REPS_BY_GOAL = {
  strength: { compound: 5, isolation: 8 },
  hypertrophy: { compound: 8, isolation: 12 },
  fatloss: { compound: 12, isolation: 12 },
  fitness: { compound: 12, isolation: 12 },
};

// Bodyweight movements that read as "as many as possible" outside a
// strength focus (evidence anchor above).
const MAX_REPS_KEYS = new Set(["pull-up", "dips", "pushup"]);

// ------------------------------------------------------------- resolution

function pickCandidate(candidates, tier, used) {
  for (const key of candidates) {
    const ex = CATALOG[key];
    if (!ex) continue;
    if (used.has(key)) continue;
    if (!ALLOWED_EQUIPMENT[tier].has(ex.equipment)) continue;
    return key;
  }
  return null;
}

function resolveSlots(slots, tier) {
  const used = new Set();
  const resolved = [];
  for (const slot of slots) {
    const key = pickCandidate(slot, tier, used);
    if (key) {
      used.add(key);
      resolved.push(key);
    }
  }
  return resolved;
}

// Item counts derive from sessionMinutes: ~10 min per compound, ~6 min per
// isolation, cap by budget, floor 4 items, cap 9 (evidence anchor: session
// time budgeting, not a strength/hypertrophy citation, just fits sessions
// inside the minutes the user actually has).
function selectByBudget(resolvedKeys, minutes) {
  const chosen = [];
  let budget = minutes;
  for (const key of resolvedKeys) {
    if (chosen.length >= 9) break;
    const ex = CATALOG[key];
    const cost = ex.compound ? 10 : 6;
    if (cost <= budget || chosen.length < 4) {
      chosen.push({ key, sets: 3 });
      budget -= cost;
    }
  }
  return chosen;
}

function buildSessionDraft(type, tier, minutes) {
  const slots = TEMPLATES[type];
  const resolved = resolveSlots(slots, tier);
  return { type, items: selectByBudget(resolved, minutes) };
}

// --------------------------------------------------------- volume adjustment

function weeklyTotals(drafts) {
  const totals = {};
  for (const draft of drafts) {
    for (const item of draft.items) {
      const ex = CATALOG[item.key];
      totals[ex.bodyPart] = (totals[ex.bodyPart] || 0) + item.sets;
    }
  }
  return totals;
}

function bumpSets(drafts, part, delta) {
  for (const draft of drafts) {
    for (const item of draft.items) {
      const ex = CATALOG[item.key];
      if (ex.bodyPart !== part || ex.compound) continue;
      if (delta > 0 && item.sets < 6) { item.sets += 1; return true; }
      if (delta < 0 && item.sets > 2) { item.sets -= 1; return true; }
    }
  }
  return false;
}

// Last-resort de-load: a short session made almost entirely of one body
// part's compounds (e.g. a 30-minute leg day) can leave no isolation item to
// trim at all once the 4-item session floor is hit. Rather than ever
// removing a protected compound, shave its OWN sets down to a floor of 2
// (still a real, commonly-programmed minimum) so the weekly total can still
// reach the experience band.
function bumpCompoundSets(drafts, part, delta) {
  for (const draft of drafts) {
    for (const item of draft.items) {
      const ex = CATALOG[item.key];
      if (ex.bodyPart !== part || !ex.compound) continue;
      if (delta < 0 && item.sets > 2) { item.sets -= 1; return true; }
    }
  }
  return false;
}

function addIsolationItem(drafts, part, tier) {
  const pool = ISOLATION_CANDIDATES[part] || [];
  for (const draft of drafts) {
    if (draft.items.length >= 9) continue;
    const used = new Set(draft.items.map((i) => i.key));
    const key = pickCandidate(pool, tier, used);
    if (key) {
      draft.items.push({ key, sets: 3 });
      return true;
    }
  }
  return false;
}

// Floor of 2 here (not the session-build floor of 4): once a session is
// down to its last couple of items there's nothing meaningful left to trim,
// but the 4-item generation floor is about not handing the user a
// suspiciously thin freshly-generated session, not about capping how far
// the volume adjuster may go afterward.
function removeIsolationItem(drafts, part) {
  for (const draft of drafts) {
    if (draft.items.length <= 2) continue;
    for (let i = draft.items.length - 1; i >= 0; i--) {
      const ex = CATALOG[draft.items[i].key];
      if (ex.bodyPart === part && !ex.compound) {
        draft.items.splice(i, 1);
        return true;
      }
    }
  }
  return false;
}

// Last-resort room-maker for a deficient body part when every session is
// already at the 9-item cap: swap out an isolation item that belongs to a
// DIFFERENT major body part currently sitting at or above its own low bound
// (so swapping it out won't itself push that other part under the band).
function swapForRoom(drafts, part, tier, totals, lo) {
  const pool = ISOLATION_CANDIDATES[part] || [];
  for (const draft of drafts) {
    if (draft.items.length < 9) continue; // only relevant once actually capped
    const used = new Set(draft.items.map((i) => i.key));
    const candidateKey = pickCandidate(pool, tier, used);
    if (!candidateKey) continue;
    for (let i = draft.items.length - 1; i >= 0; i--) {
      const ex = CATALOG[draft.items[i].key];
      if (ex.compound || ex.bodyPart === part || !MAJOR_PARTS.includes(ex.bodyPart)) continue;
      const otherTotal = totals[ex.bodyPart] || 0;
      if (otherTotal - draft.items[i].sets >= lo) {
        draft.items.splice(i, 1, { key: candidateKey, sets: 3 });
        return true;
      }
    }
  }
  return false;
}

// Weekly working-set target band, clamped for a 2-day/week split.
//
// Two sessions/week structurally cannot fit "advanced" (16-20 sets/part on
// FIVE major body parts) without exceeding the generator's own per-session
// item cap (9 items/session x 2 sessions = 18 total item slots for 5 parts
// + core, each item capped at 6 sets) -- the earlier attempt to hit 16-20
// on 2 days left one part (usually arms) permanently a few sets short, no
// matter how the adjuster shuffled items. Rather than leave that band
// silently unreachable, a 2-day split clamps its target to 10-14 sets/part
// for EVERY experience level: the frequency evidence itself favors adding a
// training day over cramming more sets into fewer, longer sessions, so a
// user who wants more volume than 10-14/part/week should add a day rather
// than have this generator quietly overshoot the per-session cap trying.
// Surfaced to the user via the "onboarding.note.twoDayCap" preview note.
export function effectiveBand(experience, daysPerWeek) {
  if (daysPerWeek === 2) return [10, 14];
  return BANDS[experience] || BANDS.intermediate;
}

// Adjusts working sets per body part (bump isolation sets first, then add or
// drop whole isolation items) until every major body part lands inside its
// target band (see effectiveBand), or no further move is possible.
function adjustVolume(drafts, tier, band) {
  const [lo, hi] = band;
  let guard = 0;
  while (guard++ < 100) {
    const totals = weeklyTotals(drafts);
    let changed = false;
    for (const part of MAJOR_PARTS) {
      const total = totals[part] || 0;
      if (total < lo) {
        if (bumpSets(drafts, part, +1) || addIsolationItem(drafts, part, tier) || swapForRoom(drafts, part, tier, totals, lo)) changed = true;
      } else if (total > hi) {
        if (bumpSets(drafts, part, -1) || removeIsolationItem(drafts, part) || bumpCompoundSets(drafts, part, -1)) changed = true;
      }
    }
    if (!changed) break;
  }
}

function repsFor(key, ex, goal) {
  if (goal !== "strength" && MAX_REPS_KEYS.has(key)) return "max";
  const table = REPS_BY_GOAL[goal] || REPS_BY_GOAL.hypertrophy;
  return ex.compound ? table.compound : table.isolation;
}

// ------------------------------------------------------------------- public

// input: {goal, daysPerWeek, experience, equipment, sessionMinutes}
// opts: {idPrefix} - built OUTSIDE this file (Date.now() lives in the caller);
// ids are `${idPrefix}-${key}` (exercises) and `${idPrefix}-s${n}` (programs),
// so the same input+idPrefix always produces the same ids.
export function generateCourse(input, opts = {}) {
  const idPrefix = opts.idPrefix || "gen";
  const tier = ALLOWED_EQUIPMENT[input?.equipment] ? input.equipment : "gym";
  const goal = REPS_BY_GOAL[input?.goal] ? input.goal : "hypertrophy";
  const experience = BANDS[input?.experience] ? input.experience : "intermediate";
  const days = SPLIT_BY_DAYS[input?.daysPerWeek] ? input.daysPerWeek : 3;
  const minutes = [30, 45, 60, 90].includes(input?.sessionMinutes) ? input.sessionMinutes : 60;

  const template = SPLIT_BY_DAYS[days];
  const drafts = template.map(([type]) => buildSessionDraft(type, tier, minutes));

  adjustVolume(drafts, tier, effectiveBand(experience, days));

  // Superset usage (C1 model): fatloss pairs the last two ISOLATION items of
  // each session (time-efficient supersetting); other goals stay plain. Only
  // pairs when both tail items are actually isolation and adjacent, matching
  // the session renderer's adjacent-index pairing contract (js/ui/today.js).
  if (goal === "fatloss") {
    drafts.forEach((draft, i) => {
      const n = draft.items.length;
      if (n < 2) return;
      const a = draft.items[n - 2];
      const b = draft.items[n - 1];
      if (CATALOG[a.key].compound || CATALOG[b.key].compound) return;
      const group = `${idPrefix}-ss-s${i + 1}`;
      a.method = "superset";
      a.supersetGroup = group;
      b.method = "superset";
      b.supersetGroup = group;
    });
  }

  // Reps by goal + warm-up sets on the first compound of each session.
  for (const draft of drafts) {
    let warmupAssigned = false;
    for (const item of draft.items) {
      const ex = CATALOG[item.key];
      item.reps = repsFor(item.key, ex, goal);
      if (!warmupAssigned && ex.compound) {
        item.warmupSets = 2;
        warmupAssigned = true;
      } else {
        item.warmupSets = 0;
      }
    }
  }

  const usedKeys = new Set();
  for (const draft of drafts) for (const item of draft.items) usedKeys.add(item.key);

  const exercises = [...usedKeys].map((key) => {
    const ex = CATALOG[key];
    return {
      id: `${idPrefix}-${key}`,
      name: ex.nameKo,
      bodyPart: ex.bodyPart,
      equipment: ex.equipment,
      unit: "lb",
      loadConvention: loadConventionFor(ex.equipment),
      variant: "",
      spinalLoad: !!ex.spinalLoad,
      emphasis: "",
      i18nKey: ex.i18nKey,
    };
  });

  const programs = drafts.map((draft, i) => {
    const [, name] = template[i];
    return {
      id: `${idPrefix}-s${i + 1}`,
      name,
      kind: "weights",
      items: draft.items.map((item) => {
        const out = {
          exerciseId: `${idPrefix}-${item.key}`,
          sets: item.sets,
          reps: item.reps,
          targetLoad: 0,
          warmupSets: item.warmupSets,
        };
        if (item.method === "superset") {
          out.method = "superset";
          out.supersetGroup = item.supersetGroup;
        }
        return out;
      }),
    };
  });

  // Rest (evidence anchor above): compounds get 150-180s (165s midpoint
  // here); isolation exercises are left out so restSecondsFor() falls back
  // to the app's 90s global default. Not part of the pack-shape proper;
  // the caller merges this into settings.restOverrides on confirm.
  const restOverrides = {};
  for (const key of usedKeys) {
    if (CATALOG[key].compound) restOverrides[`${idPrefix}-${key}`] = 165;
  }

  const notes = ["onboarding.note.volume", "onboarding.note.freq"];
  if (goal === "fatloss") notes.push("onboarding.note.cardio");
  // Surfaces the days=2 band clamp (see effectiveBand) so the user
  // understands why the preview's per-part sets read lower than the
  // usual 10-20 range, and what to do about it.
  if (days === 2) notes.push("onboarding.note.twoDayCap");

  return { exercises, programs, notes, restOverrides };
}

// Working sets per body part across the WHOLE returned course (one program
// per weekly session, so summing across all of them is the weekly total).
// Exposed for tests and for the onboarding preview's per-part chips.
export function volumeReport(course) {
  const byId = {};
  for (const ex of course.exercises) byId[ex.id] = ex;
  const totals = {};
  for (const program of course.programs) {
    for (const item of program.items) {
      const ex = byId[item.exerciseId];
      if (!ex) continue;
      totals[ex.bodyPart] = (totals[ex.bodyPart] || 0) + item.sets;
    }
  }
  return totals;
}
