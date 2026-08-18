'use client'

/**
 * Demo-mode photo storage.
 *
 * Photos are the one thing that genuinely does not belong on the server in
 * demo mode: they are large, they are personal, and the demo has no account to
 * attach them to. IndexedDB holds the Blob itself keyed by the media id that
 * the recipe record refers to, which keeps the recipe data small and portable
 * while the bytes stay on the device. localStorage and cookies are not options
 * -- both are string-only and far too small for a photograph.
 */

const DB_NAME = 'impasto-media'
const DB_VERSION = 1
const STORE = 'blobs'

interface StoredBlob {
  id: string
  blob: Blob
  type: string
  createdAt: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the media store'))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = run(transaction.objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Media store request failed'))
    })
  } finally {
    db.close()
  }
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  const record: StoredBlob = { id, blob, type: blob.type, createdAt: Date.now() }
  await withStore('readwrite', (store) => store.put(record) as IDBRequest<IDBValidKey>)
}

export async function getBlob(id: string): Promise<Blob | null> {
  try {
    const record = await withStore('readonly', (store) => store.get(id) as IDBRequest<StoredBlob>)
    return record?.blob ?? null
  } catch {
    return null
  }
}

export async function deleteBlob(id: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(id) as IDBRequest<undefined>)
  } catch {
    // Already gone, which is the outcome the caller wanted.
  }
}

export async function listBlobIds(): Promise<string[]> {
  try {
    const keys = await withStore(
      'readonly',
      (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>,
    )
    return keys.map(String)
  } catch {
    return []
  }
}

/** Used by "reset demo data", which must not leave the photos behind. */
export async function clearBlobs(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.clear() as IDBRequest<undefined>)
  } catch {
    // Nothing stored yet.
  }
}

/**
 * Object URLs for blobs already read, so a list of photos does not re-read
 * IndexedDB on every render or leak a URL per render.
 */
const urlCache = new Map<string, string>()

export async function blobUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id)
  if (cached) return cached

  const blob = await getBlob(id)
  if (!blob) return null

  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

export function forgetBlobUrl(id: string): void {
  const url = urlCache.get(id)
  if (!url) return
  URL.revokeObjectURL(url)
  urlCache.delete(id)
}
