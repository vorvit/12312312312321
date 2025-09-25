// Lightweight IndexedDB cache for IFC bytes
// Stores entries keyed by `${filename}:${size}:${etag}` to invalidate when file changes

const DB_NAME = 'ifc-cache-db';
const STORE_NAME = 'files';
const DB_VERSION = 1;

type IFCEntry = {
  key: string;
  bytes: ArrayBuffer;
  savedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getKey(filename: string, size?: number, etag?: string | null): string {
  return `${filename}:${size || 0}:${etag || ''}`;
}

export async function getIFCFromCache(filename: string, size?: number, etag?: string | null): Promise<Uint8Array | null> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(getKey(filename, size, etag));
      req.onsuccess = () => {
        const entry = req.result as IFCEntry | undefined;
        if (entry && entry.bytes) {
          resolve(new Uint8Array(entry.bytes));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB get failed, skipping cache:', e);
    return null;
  }
}

export async function putIFCToCache(filename: string, size: number | undefined, etag: string | null | undefined, bytes: Uint8Array): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: IFCEntry = { key: getKey(filename, size, etag || null), bytes: bytes.buffer, savedAt: Date.now() };
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB put failed, skipping cache:', e);
  }
}

export async function hasIFCInCache(filename: string, size?: number, etag?: string | null): Promise<boolean> {
  const bytes = await getIFCFromCache(filename, size, etag);
  return !!bytes;
}

export async function deleteIFCFromCache(filename: string, size?: number, etag?: string | null): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(getKey(filename, size, etag));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB delete failed, skipping:', e);
  }
}
