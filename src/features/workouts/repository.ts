import type { WorkoutRecord } from "./model";

const DATABASE = "ARCUS-training";
const VERSION = 1;
const STORE = "workouts";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("status", "status");
        store.createIndex("startedAt", "startedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local workout storage."));
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    let result: T;
    let requestComplete = false;
    let settled = false;
    request.onsuccess = () => { result = request.result; requestComplete = true; };
    request.onerror = () => {
      if (!settled) { settled = true; reject(request.error ?? new Error("Local workout storage failed.")); }
    };
    transaction.oncomplete = () => {
      db.close();
      if (!settled) {
        settled = true;
        if (requestComplete) resolve(result);
        else reject(new Error("Local workout transaction completed without a result."));
      }
    };
    transaction.onabort = transaction.onerror = () => {
      db.close();
      if (!settled) { settled = true; reject(transaction.error ?? new Error("Local workout transaction failed.")); }
    };
  });
}

export async function saveWorkout(workout: WorkoutRecord): Promise<void> {
  await transact("readwrite", (store) => store.put({ ...workout, updatedAt: new Date().toISOString() }));
}

// Server acknowledgements and restores preserve the original revision.
export async function cacheWorkout(workout:WorkoutRecord):Promise<void> {
  await transact("readwrite",store=>store.put(workout));
}

export async function saveWorkouts(workouts: WorkoutRecord[]): Promise<void> {
  if (workouts.length === 0) return;
  await transact("readwrite", (store) => {
    let lastRequest: IDBRequest<IDBValidKey> | null = null;
    for (const workout of workouts) lastRequest = store.put({ ...workout, updatedAt: new Date().toISOString() });
    return lastRequest as IDBRequest<IDBValidKey>;
  });
}

export async function getActiveWorkout(): Promise<WorkoutRecord | null> {
  const rows = await transact<WorkoutRecord[]>("readonly", (store) => store.index("status").getAll("active"));
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export async function getWorkoutById(id: string): Promise<WorkoutRecord | null> {
  const workout = await transact<WorkoutRecord | undefined>("readonly", (store) => store.get(id));
  return workout ?? null;
}

export async function getCompletedWorkouts(): Promise<WorkoutRecord[]> {
  const rows = await transact<WorkoutRecord[]>("readonly", (store) => store.index("status").getAll("completed"));
  return rows.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

export async function getPendingWorkouts(): Promise<WorkoutRecord[]> {
  const rows = await transact<WorkoutRecord[]>("readonly", (store) => store.index("status").getAll("completed"));
  return rows.filter((workout) => workout.syncStatus !== "synced");
}

export async function deleteWorkoutsByImportBatch(batchId: string): Promise<number> {
  const rows = await transact<WorkoutRecord[]>("readonly", (store) => store.getAll());
  const matches = rows.filter((workout) => workout.importBatchId === batchId);
  for (const workout of matches) await transact("readwrite", (store) => store.delete(workout.id));
  return matches.length;
}

export async function deleteWorkout(id: string): Promise<void> {
  await transact("readwrite", (store) => store.delete(id));
}
