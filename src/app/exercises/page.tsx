"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Dumbbell, Plus, Search, Star, Trash2, X } from "lucide-react";
import { exerciseCatalog, searchExercises, type Exercise } from "@/features/exercises/catalog";
import { deleteCustomExercise, getExercisePreferences, listCustomExercises, saveCustomExercise, setExerciseFavorite } from "@/features/local-data/repository";

const muscles = ["Chest", "Upper chest", "Lats", "Upper back", "Traps", "Front delts", "Side delts", "Rear delts", "Biceps", "Triceps", "Forearms", "Abs", "Obliques", "Erectors", "Quads", "Hamstrings", "Glutes", "Calves", "Adductors"];

export default function ExercisesPage() {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Exercise[]>(exerciseCatalog);
  const [preferences, setPreferences] = useState<{ id: string; favorite: boolean; usedAt: string | null; useCount: number }[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const [custom, prefs] = await Promise.all([listCustomExercises(), getExercisePreferences()]);
    setCatalog([...exerciseCatalog, ...custom]); setPreferences(prefs);
  };
  useEffect(() => { let cancelled = false; void Promise.all([listCustomExercises(), getExercisePreferences()]).then(([custom, prefs]) => { if (!cancelled) { setCatalog([...exerciseCatalog, ...custom]); setPreferences(prefs); } }).catch(() => { if (!cancelled) setMessage("Could not read the local exercise catalog."); }); return () => { cancelled = true; }; }, []);

  const exercises = useMemo(() => {
    const results = searchExercises(query, catalog);
    if (query.trim()) return results;
    const byId = new Map(preferences.map((preference) => [preference.id, preference]));
    return [...results].sort((a, b) => {
      const left = byId.get(a.id), right = byId.get(b.id);
      const rank = (preference: typeof left) => preference?.usedAt && Date.now() - Date.parse(preference.usedAt) < 30 * 86400000 ? 0 : preference?.favorite ? 1 : preference?.useCount ? 2 : 3;
      return rank(left) - rank(right) || (right?.useCount ?? 0) - (left?.useCount ?? 0) || a.name.localeCompare(b.name);
    });
  }, [query, catalog, preferences]);

  async function createCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) { setMessage("Enter an exercise name."); return; }
    const exercise: Exercise = {
      id: crypto.randomUUID(), name, muscle: String(data.get("muscle")), equipment: String(data.get("equipment")),
      pattern: String(data.get("pattern") ?? "Other").trim() || "Other",
      aliases: String(data.get("aliases") ?? "").split(",").map((alias) => alias.trim()).filter(Boolean),
      restSeconds: Math.min(600, Math.max(0, Number(data.get("rest")) || 90)), isCustom: true,
    };
    await saveCustomExercise(exercise); await refresh(); setFormOpen(false); setMessage(`${name} added to your exercise catalog.`); form.reset();
  }

  async function toggleFavorite(exercise: Exercise) {
    const current = preferences.find((preference) => preference.id === exercise.id);
    await setExerciseFavorite(exercise.id, !current?.favorite); await refresh();
  }

  async function removeCustom(exercise: Exercise) {
    if (!window.confirm(`Remove custom exercise “${exercise.name}”? Its saved workout history will keep the name snapshot.`)) return;
    await deleteCustomExercise(exercise.id); await refresh(); setMessage(`${exercise.name} removed from the catalog.`);
  }

  return <main className="workout-shell">
    <header className="workout-top"><Link className="back-link" href="/dashboard"><ArrowLeft size={17} /> Dashboard</Link><Link className="offline-badge" href="/workout"><span /> START SESSION</Link></header>
    <section className="history-heading"><p className="eyebrow"><span className="live-dot" /> MOVEMENT LIBRARY</p><h1>Exercises<span>.</span></h1><p>Search names, aliases, muscle groups, or equipment.</p></section>
    <div className="exercise-library-actions"><label className="search-box catalog-search"><Search size={17} /><input placeholder="Try “rdl”, “stiff leg deadlift”, or “quads”" value={query} onChange={(event) => setQuery(event.target.value)} /><span>{exercises.length} MOVES</span></label><button className="outline-button" onClick={() => setFormOpen(!formOpen)}>{formOpen ? <X size={15}/> : <Plus size={15}/>} Custom exercise</button></div>
    {formOpen && <form className="custom-exercise-form" onSubmit={(event) => void createCustom(event)}><div className="custom-form-head"><strong>Add a custom movement</strong><span>Saved on this device</span></div><div className="form-grid"><label>Name<input name="name" maxLength={80} placeholder="e.g. Landmine press" required/></label><label>Primary muscle<select name="muscle">{muscles.map((muscle) => <option key={muscle}>{muscle}</option>)}</select></label><label>Equipment<input name="equipment" maxLength={40} placeholder="Barbell, machine…" required/></label><label>Movement pattern<input name="pattern" maxLength={50} placeholder="Horizontal push"/></label><label>Aliases<input name="aliases" placeholder="Also known as, separated by commas"/></label><label>Default rest · seconds<input name="rest" type="number" min="0" max="600" defaultValue="90"/></label></div><div className="custom-form-actions"><button className="action-button" type="submit">Save exercise <Plus size={15}/></button></div></form>}
    <section className="catalog-grid">{exercises.map((exercise) => { const favorite = preferences.find((preference) => preference.id === exercise.id)?.favorite ?? false; return <article className="catalog-card" key={exercise.id}><div className="catalog-card-top"><span className="exercise-glyph"><Dumbbell size={16} /></span><div><button className={`favorite-button ${favorite ? "favorite-active" : ""}`} aria-label={favorite ? `Remove ${exercise.name} from favorites` : `Favorite ${exercise.name}`} onClick={() => void toggleFavorite(exercise)}><Star size={15} fill={favorite ? "currentColor" : "none"}/></button>{exercise.isCustom && <button className="icon-button remove-button custom-delete" aria-label={`Delete ${exercise.name}`} onClick={() => void removeCustom(exercise)}><Trash2 size={14}/></button>}</div></div><strong>{exercise.name}</strong><span>{exercise.muscle} · {exercise.equipment}</span><small>{exercise.pattern}</small><Link className="catalog-add" href={`/workout?add=${encodeURIComponent(exercise.id)}`}>Add to session <Plus size={13}/></Link></article>; })}</section>
    {exercises.length === 0 && <p className="empty-search">No exercises found. Try another name, alias, or muscle.</p>}
    {message && <p role="status" className="inline-message">{message}</p>}
  </main>;
}
