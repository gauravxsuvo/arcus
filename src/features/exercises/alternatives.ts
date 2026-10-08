import type { Exercise } from "./catalog";

export function findExerciseAlternatives(source: Exercise, catalog: Exercise[], limit = 5) {
  return catalog.filter((exercise) => exercise.id !== source.id).map((exercise) => {
    let score = 0;
    if (exercise.pattern.toLowerCase() === source.pattern.toLowerCase()) score += 4;
    if (exercise.muscle.toLowerCase() === source.muscle.toLowerCase()) score += 3;
    if (exercise.equipment.toLowerCase() === source.equipment.toLowerCase()) score += 1;
    if (exercise.pattern.toLowerCase().includes(source.pattern.toLowerCase()) || source.pattern.toLowerCase().includes(exercise.pattern.toLowerCase())) score += 1;
    return { exercise, score };
  }).filter((item) => item.score >= 4).sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name)).slice(0, limit).map(({ exercise, score }) => ({ exercise, reason: score >= 7 ? "Same movement focus and muscle" : score >= 5 ? "Similar movement pattern" : "Related training option" }));
}
