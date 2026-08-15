// Calisthenics skill-goal programs (v1.12.0). Curated, evidence-anchored
// curricula for the classic bodyweight skill goals, consumed by the Session
// tab's skill card (js/ui/today.js).
//
// Evidence anchors (checked 2026-08-15):
//  - Advancement rule: start a progression at ~3x5 clean reps, advance to the
//    next progression at 3x8 (r/bodyweightfitness Recommended Routine
//    standard); hold-based steps advance around 12-30s holds (GMB planche
//    guide; Kavadlo cites ~12s as adequate, community standard 15-30s).
//    The in-app copy uses "3x8 or 15s+ holds" as the conservative midpoint.
//  - Muscle-up prerequisites: ~8-10 strict pull-ups and 10-15 dips before
//    dedicated muscle-up work; the path is explosive chest-to-bar pulls,
//    then slow negatives through the transition (BarBend / WODprep /
//    CrossFit coaching guides all converge on this order).
//  - Planche path: lean -> tuck -> (advanced tuck ->) straddle, with pseudo
//    planche push-ups as the loading accessory (GMB planche progression).
//  - Front lever path: tuck -> advanced tuck -> straddle, rows/pull-ups as
//    the pulling base.
//  - L-sit/support work: ~30s accumulated holds is the standard target
//    before harder variations (Recommended Routine support-hold standard).
//
// Item shape mirrors generator items: { key, sets, reps } where reps "max"
// on a HOLD-type exercise means "time the hold" (the session flow's time
// mode records seconds; hold exercises default to time mode by i18nKey).

import { CATALOG, loadConventionFor } from "./gen.js";

export const SKILLS = [
  {
    id: "muscleup",
    levels: {
      beginner: [
        { key: "pull-up", sets: 3, reps: 8 },
        { key: "dips", sets: 3, reps: 10 },
        { key: "high-pullup", sets: 5, reps: 3 },
        { key: "hanging-leg-raise", sets: 3, reps: 10 },
      ],
      advanced: [
        { key: "high-pullup", sets: 5, reps: 3 },
        { key: "mu-negative", sets: 5, reps: 2 },
        { key: "dips", sets: 3, reps: 10 },
        { key: "pull-up", sets: 3, reps: 8 },
      ],
    },
  },
  {
    id: "planche",
    levels: {
      beginner: [
        { key: "planche-lean", sets: 4, reps: "max" },
        { key: "pseudo-planche-pushup", sets: 3, reps: 5 },
        { key: "pike-pushup", sets: 3, reps: 8 },
        { key: "l-sit", sets: 3, reps: "max" },
      ],
      advanced: [
        { key: "tuck-planche", sets: 5, reps: "max" },
        { key: "planche-lean", sets: 3, reps: "max" },
        { key: "pseudo-planche-pushup", sets: 4, reps: 8 },
        { key: "dips", sets: 3, reps: 10 },
      ],
    },
  },
  {
    id: "frontlever",
    levels: {
      beginner: [
        { key: "tuck-front-lever", sets: 4, reps: "max" },
        { key: "inverted-row", sets: 3, reps: 8 },
        { key: "pull-up", sets: 3, reps: 5 },
        { key: "hanging-leg-raise", sets: 3, reps: 8 },
      ],
      advanced: [
        { key: "tuck-front-lever", sets: 5, reps: "max" },
        { key: "pull-up", sets: 3, reps: 8 },
        { key: "inverted-row", sets: 3, reps: 10 },
        { key: "hanging-leg-raise", sets: 3, reps: 12 },
      ],
    },
  },
  {
    id: "handstand",
    levels: {
      beginner: [
        { key: "wall-handstand-hold", sets: 4, reps: "max" },
        { key: "pike-pushup", sets: 3, reps: 8 },
        { key: "plank", sets: 3, reps: "max" },
        { key: "pushup", sets: 3, reps: 10 },
      ],
      advanced: [
        { key: "wall-handstand-pushup", sets: 3, reps: 5 },
        { key: "wall-handstand-hold", sets: 3, reps: "max" },
        { key: "pike-pushup", sets: 3, reps: 10 },
        { key: "diamond-pushup", sets: 3, reps: 8 },
      ],
    },
  },
  {
    id: "lsit",
    levels: {
      beginner: [
        { key: "l-sit", sets: 4, reps: "max" },
        { key: "hanging-leg-raise", sets: 3, reps: 8 },
        { key: "plank", sets: 3, reps: "max" },
        { key: "crunch", sets: 3, reps: 12 },
      ],
      advanced: [
        { key: "l-sit", sets: 5, reps: "max" },
        { key: "hanging-leg-raise", sets: 3, reps: 12 },
        { key: "dips", sets: 3, reps: 8 },
        { key: "plank", sets: 3, reps: "max" },
      ],
    },
  },
];

export const SKILL_LEVELS = ["beginner", "advanced"];

// Library-shaped record for a skill exercise, id = catalog key (skill
// programs reference library ids directly so history stays connected).
export function skillExerciseRecord(key) {
  const ex = CATALOG[key];
  return {
    id: key,
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
}
