import { searchExercises, type Exercise } from "./catalog.ts";
import { exerciseContent } from "./content.ts";

export type PickerPreference = { id: string; favorite: boolean; usedAt: string | null; useCount: number };
export type PickerFilters = { query: string; muscle: string; equipment: string; collection: "all" | "favorites" | "recent" };

export function filterPickerExercises(catalog: Exercise[], preferences: PickerPreference[], filters: PickerFilters, now = Date.now()) {
  const byId = new Map(preferences.map(preference => [preference.id, preference]));
  const recent = (preference?: PickerPreference) => {
    const date = Date.parse(preference?.usedAt ?? "");
    return Number.isFinite(date) && date <= now && date >= now - 30 * 86400000;
  };
  return searchExercises(filters.query, catalog).filter(exercise => {
    const muscles = exerciseContent(exercise);
    const preference = byId.get(exercise.id);
    return (!filters.muscle || [...muscles.primary, ...muscles.secondary].includes(filters.muscle))
      && (!filters.equipment || exercise.equipment === filters.equipment)
      && (filters.collection !== "favorites" || preference?.favorite)
      && (filters.collection !== "recent" || recent(preference));
  }).sort((a, b) => {
    const left = byId.get(a.id), right = byId.get(b.id);
    const rank = (preference?: PickerPreference) => recent(preference) ? 0 : preference?.favorite ? 1 : preference?.useCount ? 2 : 3;
    return rank(left) - rank(right) || (right?.useCount ?? 0) - (left?.useCount ?? 0) || a.name.localeCompare(b.name);
  });
}
