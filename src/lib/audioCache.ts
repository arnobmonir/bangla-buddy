const DB_NAME = 'baby-bangla-audio'
const STORE = 'clips'
const DB_VERSION = 1

export type CacheEntry = {
  key: string
  blob: Blob
  bytes: number
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

function cacheKey(voice: string, text: string, rate: number) {
  return `${voice}|${rate.toFixed(2)}|${text}`
}

export async function getCachedAudio(
  voice: string,
  text: string,
  rate: number,
): Promise<Blob | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(cacheKey(voice, text, rate))
    req.onsuccess = () => {
      const row = req.result as CacheEntry | undefined
      resolve(row?.blob ?? null)
    }
    req.onerror = () => reject(req.error ?? new Error('cache read failed'))
  })
}

export async function putCachedAudio(
  voice: string,
  text: string,
  rate: number,
  blob: Blob,
): Promise<void> {
  const db = await openDb()
  const entry: CacheEntry = {
    key: cacheKey(voice, text, rate),
    blob,
    bytes: blob.size,
    createdAt: Date.now(),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('cache write failed'))
  })
}

export async function clearAudioCache(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('cache clear failed'))
  })
}

export async function getAudioCacheStats(): Promise<{ count: number; bytes: number }> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const rows = (req.result ?? []) as CacheEntry[]
      resolve({
        count: rows.length,
        bytes: rows.reduce((sum, row) => sum + (row.bytes || 0), 0),
      })
    }
    req.onerror = () => reject(req.error ?? new Error('cache stats failed'))
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
