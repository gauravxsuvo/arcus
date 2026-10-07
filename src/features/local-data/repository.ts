import type { Exercise } from "@/features/exercises/catalog";
import type { TrainingProgram } from "@/features/programs/model";
import type { PhysiqueEntry } from "@/features/physique/model";

const DB_NAME = "forge-local-data";
const DB_VERSION = 1;
const STORES = { programs: "programs", measurements: "measurements", exercisePreferences: "exercisePreferences", customExercises: "customExercises" } as const;

type ExercisePreference = { id: string; favorite: boolean; usedAt: string | null; useCount: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.programs)) db.createObjectStore(STORES.programs, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORES.measurements)) {
        const store = db.createObjectStore(STORES.measurements, { keyPath: "id" });
        store.createIndex("kind", "kind");
        store.createIndex("measuredAt", "measuredAt");
      }
      if (!db.objectStoreNames.contains(STORES.exercisePreferences)) db.createObjectStore(STORES.exercisePreferences, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORES.customExercises)) db.createObjectStore(STORES.customExercises, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local data storage."));
  });
}

async function request<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = run(tx.objectStore(storeName));
    let result: T;
    let gotResult = false;
    let settled = false;
    req.onsuccess = () => { result = req.result; gotResult = true; };
    req.onerror = () => { if (!settled) { settled = true; reject(req.error ?? new Error("Local data operation failed.")); } };
    tx.oncomplete = () => {
      db.close();
      if (settled) return;
      settled = true;
      if (gotResult) resolve(result);
      else reject(new Error("Local data transaction completed without a result."));
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      if (!settled) { settled = true; reject(tx.error ?? new Error("Local data transaction failed.")); }
    };
  });
}

export async function listPrograms() {
  const programs = await request<TrainingProgram[]>(STORES.programs, "readonly", (store) => store.getAll());
  return programs.filter((program) => !program.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPendingPrograms() {
  const programs = await request<TrainingProgram[]>(STORES.programs, "readonly", (store) => store.getAll());
  return programs.filter((program) => program.syncStatus !== "synced");
}

export async function saveProgram(program: TrainingProgram) {
  await request(STORES.programs, "readwrite", (store) => store.put(program));
}

export async function removeProgram(id: string) {
  const programs = await request<TrainingProgram[]>(STORES.programs, "readonly", (store) => store.getAll());
  const program = programs.find((program) => program.id === id);
  if (program) await saveProgram({ ...program, deleted: true, syncStatus: "pending", updatedAt: new Date().toISOString() });
}

export async function hardDeleteProgram(id: string) {
  await request(STORES.programs, "readwrite", (store) => store.delete(id));
}

export async function listPhysiqueEntries(kind?: PhysiqueEntry["kind"]) {
  const entries = await request<PhysiqueEntry[]>(STORES.measurements, "readonly", (store) => kind ? store.index("kind").getAll(kind) : store.getAll());
  return entries.filter((entry) => !entry.deleted).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
}

export async function getPendingPhysiqueEntries() {
  const entries = await request<PhysiqueEntry[]>(STORES.measurements, "readonly", (store) => store.getAll());
  return entries.filter((entry) => entry.deleted || entry.syncStatus !== "synced");
}

export async function savePhysiqueEntry(entry: PhysiqueEntry) {
  await request(STORES.measurements, "readwrite", (store) => store.put(entry));
}

export async function deletePhysiqueEntry(id: string) {
  const entries = await request<PhysiqueEntry[]>(STORES.measurements, "readonly", (store) => store.getAll());
  const entry = entries.find((entry) => entry.id === id);
  if (entry) await savePhysiqueEntry({ ...entry, deleted: true, syncStatus: "pending" });
}

export async function hardDeletePhysiqueEntry(id: string) {
  await request(STORES.measurements, "readwrite", (store) => store.delete(id));
}

export async function listCustomExercises(): Promise<Exercise[]> {
  const exercises = await request<Exercise[]>(STORES.customExercises, "readonly", (store) => store.getAll());
  return exercises.filter((exercise) => !exercise.deleted);
}

export async function getPendingCustomExercises(): Promise<Exercise[]> {
  const exercises = await request<Exercise[]>(STORES.customExercises, "readonly", (store) => store.getAll());
  return exercises.filter((exercise) => exercise.deleted || exercise.syncStatus !== "synced");
}

export async function saveCustomExercise(exercise: Exercise) {
  await request(STORES.customExercises, "readwrite", (store) => store.put(exercise));
}

export async function deleteCustomExercise(id: string) {
  const exercises = await request<Exercise[]>(STORES.customExercises, "readonly", (store) => store.getAll());
  const exercise = exercises.find((item) => item.id === id);
  if (exercise) await saveCustomExercise({ ...exercise, deleted: true, syncStatus: "pending" });
}

export async function hardDeleteCustomExercise(id: string) {
  await request(STORES.customExercises, "readwrite", (store) => store.delete(id));
}

async function getExercisePreference(id: string): Promise<ExercisePreference> {
  const pref = await request<ExercisePreference | undefined>(STORES.exercisePreferences, "readonly", (store) => store.get(id));
  return pref ?? { id, favorite: false, usedAt: null, useCount: 0 };
}

export async function getExercisePreferences() {
  return request<ExercisePreference[]>(STORES.exercisePreferences, "readonly", (store) => store.getAll());
}

export async function setExerciseFavorite(id: string, favorite: boolean) {
  const current = await getExercisePreference(id);
  await request(STORES.exercisePreferences, "readwrite", (store) => store.put({ ...current, favorite }));
}

export async function markExerciseUsed(id: string) {
  const current = await getExercisePreference(id);
  await request(STORES.exercisePreferences, "readwrite", (store) => store.put({ ...current, usedAt: new Date().toISOString(), useCount: current.useCount + 1 }));
}
