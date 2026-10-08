import type { Exercise } from "@/features/exercises/catalog";
import type { TrainingProgram } from "@/features/programs/model";
import type { PhysiqueEntry } from "@/features/physique/model";
import type { UserProfile, ExerciseSettings, WeeklyRecap, ProfilePreferences } from "@/features/profile/model";

const DB_NAME = "ARCUS-local-data";
const DB_VERSION = 4;
const STORES = { programs: "programs", measurements: "measurements", exercisePreferences: "exercisePreferences", customExercises: "customExercises", users: "users", sessions: "sessions", imports: "imports", settings: "settings", recaps: "recaps" } as const;

export type LocalUser = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  name: string;
  profile: UserProfile;
  syncStatus?: "pending" | "synced" | "error";
  updatedAt?: string;
  createdAt: string;
};

export type ImportBatch = {
  id: string;
  source: "hevy" | "generic";
  filename: string;
  fileHash: string;
  importedAt: string;
  workoutCount: number;
  setCount: number;
  warningCount: number;
  skippedRows: number;
  status: "completed" | "failed";
};

type LocalSession = { id: "current"; userId: string };

export type ExercisePreference = { id: string; favorite: boolean; usedAt: string | null; useCount: number; updatedAt?:string; syncStatus?:"pending"|"synced"|"error" };

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
      if (!db.objectStoreNames.contains(STORES.users)) {
        const store = db.createObjectStore(STORES.users, { keyPath: "id" });
        store.createIndex("username", "username", { unique: true });
      }
      if (!db.objectStoreNames.contains(STORES.sessions)) db.createObjectStore(STORES.sessions, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORES.recaps)) db.createObjectStore(STORES.recaps, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORES.imports)) {
        const store = db.createObjectStore(STORES.imports, { keyPath: "id" });
        store.createIndex("fileHash", "fileHash", { unique: false });
        store.createIndex("importedAt", "importedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local data storage."));
  });
}

async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function registerLocalUser(input: { username: string; email: string; password: string; name: string }): Promise<LocalUser> {
  const username = input.username.trim().toLowerCase();
  const users = await request<LocalUser[]>(STORES.users, "readonly", (store) => store.getAll());
  if (users.some((user) => user.username === username)) throw new Error("That username is already taken.");
  const user: LocalUser = { id: crypto.randomUUID(), username, email: input.email.trim(), passwordHash: await hashPassword(input.password), name: input.name.trim(), profile: { experience: null, goals: [], height_cm: null, bio: null, avatarUrl: null, age: null, sex: null, equipment: [] }, createdAt: new Date().toISOString() };
  await request(STORES.users, "readwrite", (store) => store.put(user));
  await request(STORES.sessions, "readwrite", (store) => store.put({ id: "current", userId: user.id } satisfies LocalSession));
  return user;
}

export async function cacheRemoteUser(input: { id: string; username: string; email: string; name: string; profile: LocalUser["profile"] }, password: string): Promise<LocalUser> {
  const cached=await request<LocalUser|undefined>(STORES.users,"readonly",store=>store.get(input.id));
  const pending=cached?.syncStatus==="pending";
  const user: LocalUser = { ...input, profile: { ...input.profile, ...(pending?cached.profile:{}), bio: pending?cached.profile.bio:input.profile.bio??null, avatarUrl:pending?cached.profile.avatarUrl:input.profile.avatarUrl??null, age:cached?.profile.age??input.profile.age??null,sex:cached?.profile.sex??input.profile.sex??null,equipment:cached?.profile.equipment??input.profile.equipment??[] }, passwordHash: await hashPassword(password), createdAt:cached?.createdAt??new Date().toISOString(),syncStatus:pending?"pending":"synced",updatedAt:cached?.updatedAt };
  const existing = await request<LocalUser | undefined>(STORES.users, "readonly", (store) => store.index("username").get(user.username.trim().toLowerCase()));
  if (existing && existing.id !== user.id) await request(STORES.users, "readwrite", (store) => store.delete(existing.id));
  await request(STORES.users, "readwrite", (store) => store.put(user));
  await request(STORES.sessions, "readwrite", (store) => store.put({ id: "current", userId: user.id } satisfies LocalSession));
  return user;
}

export async function loginLocalUser(username: string, password: string): Promise<LocalUser> {
  const users = await request<LocalUser[]>(STORES.users, "readonly", (store) => store.getAll());
  const user = users.find((item) => item.username === username.trim().toLowerCase());
  if (!user || user.passwordHash !== await hashPassword(password)) throw new Error("Incorrect username or password.");
  await request(STORES.sessions, "readwrite", (store) => store.put({ id: "current", userId: user.id } satisfies LocalSession));
  return user;
}

export async function getLocalSession(): Promise<LocalUser | null> {
  const session = await request<LocalSession | undefined>(STORES.sessions, "readonly", (store) => store.get("current"));
  if (!session) return null;
  return (await request<LocalUser | undefined>(STORES.users, "readonly", (store) => store.get(session.userId))) ?? null;
}

export async function updateLocalUser(user: LocalUser): Promise<void> {
  await request(STORES.users, "readwrite", (store) => store.put(user));
  window.dispatchEvent(new Event("arcus-profile-updated"));
}

export async function listExerciseSettings(): Promise<ExerciseSettings[]> {
  return (await request<ExerciseSettings[]>(STORES.settings, "readonly", (store) => store.getAll())).filter((item) => item.id !== "preferences");
}
export async function saveExerciseSettings(value: ExerciseSettings) {
  await request(STORES.settings, "readwrite", (store) => store.put(value));
}
export async function getDevicePreferences(): Promise<ProfilePreferences | undefined> {
  return (await request<{ id: string; value: ProfilePreferences } | undefined>(STORES.settings, "readonly", (store) => store.get("preferences")))?.value;
}
export async function saveDevicePreferences(value: ProfilePreferences) {
  await request(STORES.settings, "readwrite", (store) => store.put({ id: "preferences", value }));
  window.dispatchEvent(new Event("arcus-profile-updated"));
}
export async function listRecaps(): Promise<WeeklyRecap[]> { return request(STORES.recaps, "readonly", (store) => store.getAll()); }
export async function saveRecap(recap: WeeklyRecap) { await request(STORES.recaps, "readwrite", (store) => store.put(recap)); }

export async function logoutLocalUser(): Promise<void> {
  await request(STORES.sessions, "readwrite", (store) => store.delete("current"));
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
        if(storeName===STORES.sessions&&mode==="readwrite")window.dispatchEvent(new Event("arcus-profile-updated"));
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
  return entries.filter((entry) => entry.syncStatus !== "synced");
}

export async function savePhysiqueEntry(entry: PhysiqueEntry) {
  await request(STORES.measurements, "readwrite", (store) => store.put({ ...entry, updatedAt:entry.updatedAt??new Date().toISOString() }));
}

export async function deletePhysiqueEntry(id: string) {
  const entries = await request<PhysiqueEntry[]>(STORES.measurements, "readonly", (store) => store.getAll());
  const entry = entries.find((entry) => entry.id === id);
  if (entry) await savePhysiqueEntry({ ...entry, deleted: true, syncStatus: "pending",updatedAt:new Date().toISOString() });
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
  return exercises.filter((exercise) => exercise.syncStatus !== "synced");
}

export async function saveCustomExercise(exercise: Exercise) {
  await request(STORES.customExercises, "readwrite", (store) => store.put({...exercise,updatedAt:exercise.updatedAt??new Date().toISOString()}));
}

export async function deleteCustomExercise(id: string) {
  const exercises = await request<Exercise[]>(STORES.customExercises, "readonly", (store) => store.getAll());
  const exercise = exercises.find((item) => item.id === id);
  if (exercise) await saveCustomExercise({ ...exercise, deleted: true, syncStatus: "pending",updatedAt:new Date().toISOString() });
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

export async function saveExercisePreference(value:ExercisePreference) {
  await request(STORES.exercisePreferences,"readwrite",store=>store.put(value));
}

export async function saveImportBatch(batch: ImportBatch) {
  await request(STORES.imports, "readwrite", (store) => store.put(batch));
}

export async function listImportBatches(): Promise<ImportBatch[]> {
  const batches = await request<ImportBatch[]>(STORES.imports, "readonly", (store) => store.getAll());
  return batches.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function deleteImportBatch(id: string) {
  await request(STORES.imports, "readwrite", (store) => store.delete(id));
}

export async function setExerciseFavorite(id: string, favorite: boolean) {
  const current = await getExercisePreference(id);
  await saveExercisePreference({ ...current, favorite, updatedAt:new Date().toISOString(), syncStatus:"pending" });
}

export async function markExerciseUsed(id: string) {
  const current = await getExercisePreference(id);
  const now=new Date().toISOString();
  await saveExercisePreference({ ...current, usedAt: now, useCount: current.useCount + 1, updatedAt:now, syncStatus:"pending" });
}
