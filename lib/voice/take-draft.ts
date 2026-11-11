import { MAX_SAMPLE_BYTES, MAX_SAMPLE_SECONDS } from "@/lib/voice/constants";

export type StoredVoiceTake = {
  promptId: string;
  blob: Blob;
  seconds: number;
};

const DB_NAME = "polivid-voice";
const STORE = "takes";

type TakeRow = {
  key: string;
  scope: string;
  promptId: string;
  blob: Blob;
  seconds: number;
};

const takeKey = (scope: string, promptId: string) => `${scope}:${promptId}`;

let queue: Promise<unknown> = Promise.resolve();
let databasePromise: Promise<IDBDatabase> | null = null;

const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const openDatabase = () => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser can't store recordings on the device."));
  }
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(STORE)) return;
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("scope", "scope", { unique: false });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          databasePromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        databasePromise = null;
        reject(request.error ?? new Error("Couldn't open saved recordings."));
      };
    });
  }
  return databasePromise;
};

const clampSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.min(MAX_SAMPLE_SECONDS, Math.round(seconds)));
};

const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => {
      event.preventDefault();
      reject(tx.error ?? new Error("Couldn't save that recording."));
    };
    tx.onabort = () => reject(tx.error ?? new Error("Couldn't save that recording."));
  });

const readScope = async (scope: string) => {
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readonly");
  const request = tx.objectStore(STORE).index("scope").getAll(scope);
  const rows = new Promise<TakeRow[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as TakeRow[]);
    request.onerror = () => reject(request.error ?? new Error("Couldn't read saved recordings."));
  });
  const done = transactionDone(tx).catch((error: unknown) => error);
  const result = await rows;
  const failure = await done;
  if (failure) throw failure;
  return result;
};

const usableTake = (row: TakeRow): StoredVoiceTake | null => {
  if (typeof row.promptId !== "string" || !(row.blob instanceof Blob)) return null;
  if (row.blob.size < 1 || row.blob.size > MAX_SAMPLE_BYTES) return null;
  return { promptId: row.promptId, blob: row.blob, seconds: clampSeconds(row.seconds) };
};

const persistScope = async (scope: string, takes: StoredVoiceTake[]) => {
  for (const take of takes) {
    if (take.blob.size > MAX_SAMPLE_BYTES) {
      throw new Error("That recording is too large to keep on this device.");
    }
  }
  const existing = await readScope(scope);
  const db = await openDatabase();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const keep = new Set(takes.map((take) => take.promptId));
  for (const row of existing) {
    if (!keep.has(row.promptId)) store.delete(row.key);
  }
  for (const take of takes) {
    if (!take.promptId || take.blob.size < 1) continue;
    const row: TakeRow = {
      key: takeKey(scope, take.promptId),
      scope,
      promptId: take.promptId,
      blob: take.blob,
      seconds: clampSeconds(take.seconds),
    };
    store.put(row);
  }
  await transactionDone(tx);
};

export const loadVoiceTakes = (scope: string) =>
  enqueue(async () => {
    if (typeof indexedDB === "undefined") return [] as StoredVoiceTake[];
    const rows = await readScope(scope);
    return rows.flatMap((row) => {
      const take = usableTake(row);
      return take ? [take] : [];
    });
  });

export const writeVoiceTakes = (scope: string, takes: StoredVoiceTake[]) => enqueue(() => persistScope(scope, takes));

export const clearVoiceTakes = (scope: string) => enqueue(() => persistScope(scope, []));

export const moveVoiceTakes = (from: string, to: string) =>
  enqueue(async () => {
    if (from === to) return;
    const rows = await readScope(from);
    if (rows.length === 0) return;
    const db = await openDatabase();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const row of rows) {
      store.delete(row.key);
      store.put({ ...row, key: takeKey(to, row.promptId), scope: to });
    }
    await transactionDone(tx);
  });
