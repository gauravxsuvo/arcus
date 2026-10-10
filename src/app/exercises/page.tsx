"use client";

import { NumericInput } from "@/components/shared/numeric-input";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronDown, Clock3, Dumbbell, Filter, Plus, Search, Star, Trash2, X } from "lucide-react";
import { exerciseCatalog, type Exercise } from "@/features/exercises/catalog";
import { deleteCustomExercise, getExercisePreferences, listCustomExercises, saveCustomExercise, setExerciseFavorite } from "@/features/local-data/repository";
import { EXERCISE_CATEGORIES, exerciseCategory, exerciseContent } from "@/features/exercises/content";
import { filterPickerExercises, type PickerFilters, type PickerPreference } from "@/features/exercises/picker";
import styles from "./exercises.module.css";

const customMuscles = ["Chest", "Upper chest", "Lats", "Upper back", "Traps", "Front delts", "Side delts", "Rear delts", "Biceps", "Triceps", "Forearms", "Abs", "Obliques", "Erectors", "Quads", "Hamstrings", "Glutes", "Calves", "Adductors"];
const collections = [{ id: "all", label: "All exercises", icon: Dumbbell }, { id: "favorites", label: "Favorites", icon: Star }, { id: "recent", label: "Recent", icon: Clock3 }] as const;

export default function ExercisesPage() {
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("all");
  const [collection, setCollection] = useState<PickerFilters["collection"]>("all");
  const [sort, setSort] = useState("alphabetical");
  const [catalog, setCatalog] = useState<Exercise[]>(exerciseCatalog);
  const [preferences, setPreferences] = useState<PickerPreference[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [visible, setVisible] = useState(24);
  const byId = useMemo(() => new Map(preferences.map(preference => [preference.id, preference])), [preferences]);

  const refresh = async () => {
    const [custom, prefs] = await Promise.all([listCustomExercises(), getExercisePreferences()]);
    setCatalog([...exerciseCatalog, ...custom]); setPreferences(prefs); setReady(true);
  };
  useEffect(() => {
    let cancelled = false;
    void Promise.all([listCustomExercises(), getExercisePreferences()]).then(([custom, prefs]) => {
      if (!cancelled) { setCatalog([...exerciseCatalog, ...custom]); setPreferences(prefs); setReady(true); }
    }).catch(() => { if (!cancelled) setError("Could not read your saved exercises. Your built-in library is still available."); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { setVisible(24); }, [query, muscleFilter, equipmentFilter, categoryFilter, collection, sort]);

  const exercises = useMemo(() => {
    const results = filterPickerExercises(catalog, preferences, { query, muscle: muscleFilter === "all" ? "" : muscleFilter, equipment: equipmentFilter === "all" ? "" : equipmentFilter, collection })
      .filter(exercise => categoryFilter === "all" || exerciseCategory(exercise) === categoryFilter);
    return [...results].sort((a, b) => {
      const left = byId.get(a.id), right = byId.get(b.id);
      return (sort === "used" ? (right?.useCount ?? 0) - (left?.useCount ?? 0) : sort === "recent" ? (Date.parse(right?.usedAt ?? "") || 0) - (Date.parse(left?.usedAt ?? "") || 0) : 0) || a.name.localeCompare(b.name);
    });
  }, [query, muscleFilter, categoryFilter, equipmentFilter, collection, sort, catalog, preferences, byId]);
  const availableMuscles = useMemo(() => [...new Set(catalog.flatMap(exercise => {
    const content = exerciseContent(exercise); return [...content.primary, ...content.secondary];
  }))].sort((a, b) => a.localeCompare(b)), [catalog]);
  const equipment = useMemo(() => [...new Set(catalog.map(exercise => exercise.equipment))].sort(), [catalog]);
  const activeFilters = Number(muscleFilter !== "all") + Number(categoryFilter !== "all") + Number(equipmentFilter !== "all");
  const hasSearch = Boolean(query.trim()) || activeFilters > 0;
  const waitingForCollection = !ready && collection !== "all";
  function resetFilters() { setQuery(""); setMuscleFilter("all"); setCategoryFilter("all"); setEquipmentFilter("all"); }

  async function mutate(key: string, action: () => Promise<void>, failureMessage: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(key); setError(""); setMessage("");
    try { await action(); }
    catch { setError(failureMessage); }
    finally { busyRef.current = false; setBusy(null); }
  }
  async function createCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) { setError("Enter an exercise name."); return; }
    const exercise: Exercise = {
      id: crypto.randomUUID(), name, muscle: String(data.get("muscle")), equipment: String(data.get("equipment")),
      pattern: String(data.get("pattern") ?? "Other").trim() || "Other",
      aliases: String(data.get("aliases") ?? "").split(",").map(alias => alias.trim()).filter(Boolean),
      restSeconds: Math.min(600, Math.max(0, data.get("rest") === "" ? 90 : Number(data.get("rest")))), isCustom: true,
      category: String(data.get("category") ?? "Compound"), primaryMuscles: [...new Set([String(data.get("muscle") ?? "Chest"), ...data.getAll("primary").map(String)])],
      instructions: String(data.get("instructions") ?? "").trim() || undefined, syncStatus: "pending", updatedAt: new Date().toISOString(),
    };
    await mutate("create", async () => {
      await saveCustomExercise(exercise); await refresh(); setFormOpen(false);
      setCollection("all"); resetFilters(); setQuery(name); setMessage(`${name} added to your exercise library.`); form.reset();
    }, "Could not save this exercise. Please try again.");
  }
  async function toggleFavorite(exercise: Exercise) {
    await mutate(exercise.id, async () => { await setExerciseFavorite(exercise.id, !byId.get(exercise.id)?.favorite); await refresh(); }, "Could not update your favorites. Please try again.");
  }
  async function removeCustom(exercise: Exercise) {
    if (busyRef.current || !window.confirm(`Remove custom exercise “${exercise.name}”? Its saved workout history will keep the name snapshot.`)) return;
    await mutate(exercise.id, async () => { await deleteCustomExercise(exercise.id); await refresh(); setMessage(`${exercise.name} removed from the library.`); }, "Could not remove this exercise. Please try again.");
  }

  return <main className={`workout-shell ${styles.page}`}>
    <header className={styles.header}><Link className={styles.back} href="/dashboard"><ArrowLeft size={17} aria-hidden="true" /> Home</Link><Link className={styles.sessionLink} href="/workout">Open workout <ArrowUpRight size={16} aria-hidden="true" /></Link></header>
    <section className={styles.heading}><div><p className={styles.kicker}>YOUR MOVEMENT LIBRARY</p><h1>Exercises</h1><p>Find a movement. Build your next session.</p></div><button className={styles.customToggle} type="button" onClick={() => setFormOpen(!formOpen)} aria-expanded={formOpen} aria-controls="custom-exercise-form" disabled={Boolean(busy)}>{formOpen ? <X size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />} {formOpen ? "Close form" : "Custom exercise"}</button></section>
    {error && <div className={styles.error} role="alert"><p>{error}</p>{!ready && <button type="button" disabled={Boolean(busy)} onClick={() => void mutate("refresh", refresh, "Your saved library could not be loaded. Please try again.")}>Retry</button>}<button type="button" className={styles.dismiss} aria-label="Dismiss error" onClick={() => setError("")}><X size={17} /></button></div>}
    {message && <p className={styles.message} role="status">{message}</p>}
    {formOpen && <form id="custom-exercise-form" className={styles.customForm} onSubmit={event => void createCustom(event)}><div className={styles.formHeading}><h2>Add your own exercise</h2><p>Saved on this device, ready for your next workout.</p></div><fieldset disabled={Boolean(busy)} className={styles.formFields}><div className={styles.formGrid}>
      <label>Name<input name="name" maxLength={80} placeholder="e.g. Landmine press" required /></label><label>Primary muscle<select name="muscle" aria-label="Primary muscle">{customMuscles.map(muscle => <option key={muscle}>{muscle}</option>)}</select></label><label>Equipment<select name="equipment" aria-label="Equipment">{["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Band", "Other"].map(item => <option key={item}>{item}</option>)}</select></label><label>Category<select name="category" aria-label="Category">{EXERCISE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label><label>Default rest (seconds)<NumericInput name="rest" min="0" max="600" defaultValue="90" /></label><label>Movement pattern<input name="pattern" maxLength={50} placeholder="e.g. Horizontal push" /></label>
    </div><details className={styles.formDetails}><summary>Additional details <ChevronDown size={16} aria-hidden="true" /></summary><div className={styles.formGrid}><label>Additional primary muscles<select name="primary" aria-label="Additional primary muscles" multiple>{customMuscles.map(muscle => <option key={muscle}>{muscle}</option>)}</select><small>Optional. Select any other muscles this exercise targets.</small></label><label>Aliases<input name="aliases" placeholder="Other names, separated by commas" /></label><label className={styles.fullWidth}>Form notes<textarea name="instructions" maxLength={2000} rows={3} placeholder="Setup cues or reminders" /></label></div></details><div className={styles.formActions}><button className={styles.primary} type="submit">{busy === "create" ? "Saving…" : "Save exercise"} <Plus size={17} aria-hidden="true" /></button></div></fieldset></form>}
    <div className={styles.collections} role="group" aria-label="Exercise collection">{collections.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={collection === id ? styles.selected : ""} aria-pressed={collection === id} onClick={() => setCollection(id)}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>)}</div>
    <section className={styles.searchPanel} aria-label="Search and filter exercises"><div className={styles.search}><Search size={19} aria-hidden="true" /><input type="search" aria-label="Search exercises" placeholder="Search exercises, muscles or equipment" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={18} aria-hidden="true" /></button>}</div><div className={styles.filterRow}><label className={styles.muscleLabel} htmlFor="exercise-muscle-select">Target muscle<select id="exercise-muscle-select" aria-label="Target muscle" value={muscleFilter} onChange={event => setMuscleFilter(event.target.value)}><option value="all">All muscles</option>{availableMuscles.map(muscle => <option key={muscle}>{muscle}</option>)}</select></label><details className={styles.moreFilters}><summary><Filter size={16} aria-hidden="true" /> More filters{activeFilters > 0 && <span>{activeFilters}</span>}<ChevronDown size={15} aria-hidden="true" /></summary><div className={styles.filterGrid}><label>Equipment<select aria-label="Equipment" value={equipmentFilter} onChange={event => setEquipmentFilter(event.target.value)}><option value="all">All equipment</option>{equipment.map(item => <option key={item}>{item}</option>)}</select></label><label>Category<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{EXERCISE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label><label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="alphabetical">Alphabetical</option><option value="used">Most used</option><option value="recent">Recently used</option></select></label></div></details></div></section>
    <div className={styles.resultsHeading}><p aria-live="polite">{waitingForCollection ? "Loading your library…" : `${exercises.length} ${exercises.length === 1 ? "exercise" : "exercises"}`}{collection === "recent" && <span> · Used in the last 30 days</span>}</p>{hasSearch && <button type="button" onClick={resetFilters}>Reset filters <X size={14} aria-hidden="true" /></button>}</div>
    {!waitingForCollection && <section className={styles.grid} aria-label="Exercise results">{exercises.slice(0, visible).map(exercise => { const favorite = byId.get(exercise.id)?.favorite ?? false; const content = exerciseContent(exercise); return <article className={styles.card} key={exercise.id}><div className={styles.cardMain}><span className={styles.glyph}><Dumbbell size={21} aria-hidden="true" /></span><Link className={styles.detailLink} href={`/exercises/${encodeURIComponent(exercise.id)}`} aria-label={`View details for ${exercise.name}`}><strong>{exercise.name}</strong><span>{content.primary.join(" · ")}</span><small>{exercise.equipment}{exercise.isCustom ? " · Custom" : ""}</small></Link><button className={`${styles.favorite} ${favorite ? styles.favorited : ""}`} type="button" aria-label={favorite ? `Remove ${exercise.name} from favorites` : `Favorite ${exercise.name}`} aria-pressed={favorite} disabled={Boolean(busy)} onClick={() => void toggleFavorite(exercise)}><Star size={20} fill={favorite ? "currentColor" : "none"} aria-hidden="true" /></button></div><div className={styles.cardFooter}>{exercise.isCustom ? <button className={styles.delete} type="button" disabled={Boolean(busy)} aria-label={`Delete ${exercise.name}`} onClick={() => void removeCustom(exercise)}><Trash2 size={16} aria-hidden="true" /> Delete</button> : <Link className={styles.detailsLink} href={`/exercises/${encodeURIComponent(exercise.id)}`}>Details <ArrowUpRight size={14} aria-hidden="true" /></Link>}<Link className={styles.add} href={`/workout?add=${encodeURIComponent(exercise.id)}`} aria-label={`Add ${exercise.name} to session`}><Plus size={16} aria-hidden="true" /> Add to session</Link></div></article>; })}</section>}
    {!waitingForCollection && visible < exercises.length && <div className={styles.loadMore}><p>Showing {Math.min(visible, exercises.length)} of {exercises.length} exercises</p><button type="button" onClick={() => setVisible(count => count + 24)}>Show more exercises <ChevronDown size={16} aria-hidden="true" /></button></div>}
    {!waitingForCollection && exercises.length === 0 && <section className={styles.empty}><span>{collection === "favorites" ? <Star size={25} aria-hidden="true" /> : <Search size={25} aria-hidden="true" />}</span><h2>{hasSearch ? "No matching exercises" : collection === "favorites" ? "Keep your go-to exercises here" : collection === "recent" ? "Your recent movements will appear here" : "No exercises yet"}</h2><p>{hasSearch ? "Try a different name, or reset your muscle and equipment filters." : collection === "favorites" ? "Tap the star on an exercise to find it faster next time." : collection === "recent" ? "Add an exercise to a workout to see it in this collection." : "Add a custom exercise to start your library."}</p><button type="button" onClick={hasSearch ? resetFilters : () => setCollection("all")}>{hasSearch ? "Reset filters" : "Browse all exercises"}</button></section>}
    <p className={styles.footerNote}>Muscle filters include primary and supporting muscles.</p>
  </main>;
}
