"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Dumbbell, Plus, Search, X } from "lucide-react";
import type { Exercise } from "@/features/exercises/catalog";
import { exerciseContent } from "@/features/exercises/content";
import { filterPickerExercises, type PickerFilters, type PickerPreference } from "@/features/exercises/picker";

export function ExercisePicker({ catalog, preferences, addedIds, onAdd, onClose, autoFocusSearch = true }: {
  catalog: Exercise[]; preferences: PickerPreference[]; addedIds: string[];
  onAdd: (exercise: Exercise) => void; onClose: () => void;
  autoFocusSearch?: boolean;
}) {
  const [filters, setFilters] = useState<PickerFilters>({ query: "", muscle: "", equipment: "", collection: "all" });
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    if (autoFocusSearch) searchRef.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [autoFocusSearch]);
  const muscles = useMemo(() => [...new Set(catalog.flatMap(exercise => {
    const content = exerciseContent(exercise); return [...content.primary, ...content.secondary];
  }))].sort(), [catalog]);
  const equipment = useMemo(() => [...new Set(catalog.map(exercise => exercise.equipment))].sort(), [catalog]);
  const results = useMemo(() => filterPickerExercises(catalog, preferences, filters), [catalog, preferences, filters]);
  const filtered = Boolean(filters.query || filters.muscle || filters.equipment || filters.collection !== "all");
  const reset = () => setFilters({ query: "", muscle: "", equipment: "", collection: "all" });

  return <section className="exercise-picker workout-picker" aria-label="Choose an exercise" onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
  }}>
    <label className="search-box"><Search size={18} aria-hidden="true"/><input ref={searchRef} aria-label="Search exercises" placeholder="Search exercises or aliases" value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })}/>{filters.query && <button type="button" className="icon-button" aria-label="Clear exercise search" onClick={() => { setFilters({ ...filters, query: "" }); searchRef.current?.focus(); }}><X size={17}/></button>}</label>
    <div className="picker-collections" role="group" aria-label="Exercise collection">{([['all','All exercises'],['favorites','Favorites'],['recent','Recent']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={filters.collection === value} onClick={() => setFilters({ ...filters, collection: value })}>{label}</button>)}</div>
    <div className="picker-filters"><label>Muscle<select aria-label="Muscle" value={filters.muscle} onChange={event => setFilters({ ...filters, muscle: event.target.value })}><option value="">All muscles</option>{muscles.map(muscle => <option key={muscle}>{muscle}</option>)}</select></label><label>Equipment<select aria-label="Equipment" value={filters.equipment} onChange={event => setFilters({ ...filters, equipment: event.target.value })}><option value="">Any equipment</option>{equipment.map(item => <option key={item}>{item}</option>)}</select></label></div>
    <div className="picker-status"><span role="status">{results.length} {results.length === 1 ? "exercise" : "exercises"}{filters.collection === "recent" ? " · last 30 days" : ""}</span>{filtered && <button className="text-action" onClick={reset}>Reset filters</button>}</div>
    <div className="picker-results">{results.map(exercise => {
      const added = addedIds.includes(exercise.id);
      const secondaryMatch = filters.muscle && !exerciseContent(exercise).primary.includes(filters.muscle);
      return <button className="picker-result" key={exercise.id} disabled={added} onClick={() => onAdd(exercise)}><span className="exercise-glyph"><Dumbbell size={16}/></span><span className="picker-name"><strong>{exercise.name}</strong><small>{exercise.muscle} · {exercise.equipment}</small>{secondaryMatch && <small>Also targets {filters.muscle.toLowerCase()}</small>}</span>{added ? <span className="picker-added"><Check size={15}/> Added</span> : <Plus size={18}/>}</button>;
    })}{results.length === 0 && <div className="picker-empty"><Search size={22}/><strong>{filters.collection === "favorites" ? "No favorites match" : filters.collection === "recent" ? "No recent exercises match" : "No exercises match"}</strong><p>{filters.collection === "favorites" ? "Favorite movements in Exercises, or browse all exercises here." : "Try another muscle, equipment type or search term."}</p><button className="outline-button" onClick={reset}>Show all exercises</button></div>}</div>
  </section>;
}
