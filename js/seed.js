// Neutral default exercise library seeded on first run. The app ships with
// no personal data; the owner's real program and history arrive via a
// program pack import (Settings > Data).

import { getAll, bulkPut } from "./store.js";

export const DEFAULT_EXERCISES = [
  { id: "squat", name: "스쿼트", bodyPart: "legs", equipment: "barbell", unit: "lb", loadConvention: "excludes-bar", variant: "", spinalLoad: true },
  { id: "deadlift", name: "데드리프트", bodyPart: "legs", equipment: "barbell", unit: "lb", loadConvention: "excludes-bar", variant: "", spinalLoad: true },
  { id: "leg-press", name: "레그프레스", bodyPart: "legs", equipment: "machine", unit: "lb", loadConvention: "stack", variant: "", spinalLoad: false },
  { id: "bench-press", name: "벤치프레스", bodyPart: "chest", equipment: "barbell", unit: "lb", loadConvention: "excludes-bar", variant: "", spinalLoad: false },
  { id: "dips", name: "딥스", bodyPart: "chest", equipment: "bodyweight", unit: "lb", loadConvention: "bodyweight", variant: "", spinalLoad: false },
  { id: "lat-pulldown", name: "랫풀다운", bodyPart: "back", equipment: "cable", unit: "lb", loadConvention: "stack", variant: "", spinalLoad: false },
  { id: "seated-row", name: "시티드로우", bodyPart: "back", equipment: "cable", unit: "kg", loadConvention: "stack", variant: "", spinalLoad: false },
  { id: "pull-up", name: "턱걸이", bodyPart: "back", equipment: "bodyweight", unit: "lb", loadConvention: "bodyweight", variant: "", spinalLoad: false },
  { id: "overhead-press", name: "오버헤드프레스", bodyPart: "shoulders", equipment: "dumbbell", unit: "lb", loadConvention: "per-hand", variant: "", spinalLoad: false },
  { id: "lateral-raise", name: "레터럴 레이즈", bodyPart: "shoulders", equipment: "dumbbell", unit: "lb", loadConvention: "per-hand", variant: "", spinalLoad: false },
];

export async function seedIfEmpty() {
  const existing = await getAll("exercises");
  if (existing.length === 0) {
    await bulkPut("exercises", DEFAULT_EXERCISES);
    return true;
  }
  return false;
}
