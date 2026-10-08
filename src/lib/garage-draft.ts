export interface GarageDraft<T> {
  value: T;
  savedAt: string;
}

const DATABASE = "v5vault-garage-drafts";
const STORE = "drafts";

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local draft storage is unavailable."));
  });
}

export async function readGarageDraft<T>(key: string): Promise<GarageDraft<T> | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await openDraftDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result as GarageDraft<T> | undefined);
      request.onerror = () => reject(request.error ?? new Error("Local draft could not be read."));
    });
  } finally {
    db.close();
  }
}

export async function saveGarageDraft<T>(key: string, value: T): Promise<void> {
  if (typeof indexedDB === "undefined") throw new Error("This browser does not support offline draft storage.");
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(
        { value, savedAt: new Date().toISOString() } satisfies GarageDraft<T>,
        key,
      );
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("The local draft could not be saved."));
    });
  } finally {
    db.close();
  }
}

export async function clearGarageDraft(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDraftDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("The local draft could not be removed."));
    });
  } finally {
    db.close();
  }
}
