'use client'

/**
 * Offline mutation queue.
 *
 * Scope is deliberately narrow: recipe drafts and cooking progress. Those are
 * the two things a cook genuinely does with no signal, and both are
 * last-writer-wins on a single owner's own data, so replaying them is safe.
 *
 * Everything else -- plans, pantry, imports -- still requires a connection and
 * fails loudly. A queue that silently replayed a shopping-list edit against a
 * server that had moved on would be worse than an honest refusal.
 *
 * Each entry carries an idempotency key, so a replay that already reached the
 * server the first time cannot create a duplicate.
 */

const STORAGE_KEY = 'impasto:mutation-queue'
const MAX_ENTRIES = 50

import type { DisplayError } from '@/lib/data/errors'

export type QueueKind = 'recipe-draft' | 'cook-session'

export type QueueStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'

export interface QueueEntry {
  id: string
  kind: QueueKind
  /** Stable across retries, so the server can recognise a repeat. */
  idempotencyKey: string
  payload: unknown
  createdAt: number
  attempts: number
  status: QueueStatus
  /** Why the last attempt failed, in the form a screen can render safely. */
  error: DisplayError | null
  /** Set when the server reported a newer version than the one we started from. */
  serverVersion: string | null
  /**
   * When the current attempt was started, for entries in `syncing`.
   *
   * Distinguishes a request that is still on the wire from one whose document
   * has gone away -- which the reclaim below needs and could not otherwise
   * tell apart. See `reclaimOrphans`.
   */
  syncingSince: number | null
}

/**
 * Cached snapshot, keyed on the raw stored string.
 *
 * `useSyncExternalStore` requires getSnapshot to return a stable reference
 * between changes -- a freshly parsed array on every call would spin forever.
 * Caching against the raw text keeps the reference stable while remaining
 * correct when storage changes underneath us, including from another tab.
 */
const EMPTY_SNAPSHOT: QueueEntry[] = []
let cachedRaw: string | null = null
let cachedValue: QueueEntry[] = EMPTY_SNAPSHOT

function read(): QueueEntry[] {
  if (typeof window === 'undefined') return EMPTY_SNAPSHOT

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return EMPTY_SNAPSHOT
  }

  if (raw === cachedRaw) return cachedValue

  cachedRaw = raw
  if (!raw) {
    cachedValue = EMPTY_SNAPSHOT
    return cachedValue
  }
  try {
    const parsed = JSON.parse(raw)
    cachedValue = Array.isArray(parsed) ? (parsed as QueueEntry[]) : EMPTY_SNAPSHOT
  } catch {
    cachedValue = EMPTY_SNAPSHOT
  }
  return cachedValue
}

function write(entries: QueueEntry[]): void {
  if (typeof window === 'undefined') return
  const next = entries.slice(0, MAX_ENTRIES)
  const raw = JSON.stringify(next)
  try {
    window.localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    // Storage full or blocked; the caller already has its own copy.
  }
  cachedRaw = raw
  cachedValue = next
  // Let every open tab and the status badge know.
  window.dispatchEvent(new CustomEvent('impasto:queue-changed'))
}

export function listQueue(): QueueEntry[] {
  return read()
}

export function pendingCount(): number {
  return read().filter((entry) => entry.status === 'pending' || entry.status === 'failed').length
}

export function enqueue(kind: QueueKind, idempotencyKey: string, payload: unknown): QueueEntry {
  // A copy: `read` returns the cached snapshot, and the shared empty one in
  // particular must never be mutated in place.
  const entries = [...read()]

  // Re-queuing the same subject replaces the older entry rather than stacking
  // two edits of one recipe.
  const existing = entries.findIndex(
    (entry) => entry.kind === kind && entry.idempotencyKey === idempotencyKey,
  )

  const entry: QueueEntry = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    idempotencyKey,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
    error: null,
    serverVersion: null,
    syncingSince: null,
  }

  if (existing >= 0) entries[existing] = entry
  else entries.unshift(entry)

  write(entries)
  return entry
}

export function updateEntry(id: string, patch: Partial<QueueEntry>): void {
  write(read().map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
}

export function removeEntry(id: string): void {
  write(read().filter((entry) => entry.id !== id))
}

export function clearSynced(): void {
  write(read().filter((entry) => entry.status !== 'synced'))
}

type FlushHandler = (
  payload: unknown,
  /* Passed to the server so a replay of a write it already applied is
     recognised rather than duplicated. */
  idempotencyKey: string,
) => Promise<{ ok: boolean; error?: DisplayError; conflict?: boolean }>

export interface FlushHandlers {
  'recipe-draft': FlushHandler
  'cook-session': FlushHandler
}

/**
 * Replays queued mutations in the order they were made.
 *
 * A conflict is never resolved by overwriting: the entry is parked as
 * `conflict` with the local copy intact, and the UI asks the owner which side
 * to keep. Replay stops at the first conflict so later edits of the same thing
 * are not applied on top of a decision that has not been made yet.
 */
let flushing = false

export async function flushQueue(handlers: FlushHandlers): Promise<{
  synced: number
  failed: number
  conflicts: number
}> {
  // One replay at a time. Two overlapping flushes would each read the same
  // pending entry before either marked it 'syncing', and a draft that creates
  // a new recipe would be saved twice.
  if (flushing) return { synced: 0, failed: 0, conflicts: 0 }
  flushing = true
  try {
    reclaimOrphans()
    return await replay(handlers)
  } finally {
    flushing = false
  }
}

/**
 * How long an attempt may be in flight before it counts as abandoned.
 *
 * The window exists because "still running" and "its document is gone" look
 * identical in local storage: a document destroyed by a navigation never gets
 * to write its result. Re-arming immediately therefore replayed a request that
 * was still on the wire -- two saves of the same draft, racing the server's own
 * idempotency check, and a second recipe when they both got past it.
 *
 * Fifteen seconds is longer than a save takes and shorter than a person waits
 * before pressing Retry. Anything still 'syncing' after it has no document
 * left to finish it.
 */
const ORPHAN_AFTER_MS = 15_000

/**
 * Re-arms entries left mid-flight by a page that went away.
 *
 * Only a running flush sets 'syncing', and only one runs at a time *within one
 * document*, so an entry still marked 'syncing' well past the window above
 * belongs to a document that is gone
 * -- a closed tab, or a navigation during the request. Replaying it is safe
 * because the idempotency key travels with it: if that lost attempt did reach
 * the server, the retry resolves to the same record instead of a second one.
 */
function reclaimOrphans(): void {
  const entries = read()
  const now = Date.now()

  const isOrphan = (entry: QueueEntry) =>
    entry.status === 'syncing' && now - (entry.syncingSince ?? 0) >= ORPHAN_AFTER_MS

  if (!entries.some(isOrphan)) return
  write(
    entries.map((entry) =>
      isOrphan(entry) ? { ...entry, status: 'pending' as const, syncingSince: null } : entry,
    ),
  )
}

async function replay(handlers: FlushHandlers): Promise<{
  synced: number
  failed: number
  conflicts: number
}> {
  const entries = read()
    .filter((entry) => entry.status === 'pending' || entry.status === 'failed')
    // Oldest first: replay in the order the owner made the changes.
    .sort((a, b) => a.createdAt - b.createdAt)

  let synced = 0
  let failed = 0
  let conflicts = 0

  for (const entry of entries) {
    updateEntry(entry.id, {
      status: 'syncing',
      attempts: entry.attempts + 1,
      syncingSince: Date.now(),
    })
    try {
      const handler = handlers[entry.kind]
      const result = await handler(entry.payload, entry.idempotencyKey)

      if (result.conflict) {
        updateEntry(entry.id, {
          status: 'conflict',
          error: result.error ?? null,
          syncingSince: null,
        })
        conflicts += 1
        break
      }
      if (result.ok) {
        updateEntry(entry.id, { status: 'synced', error: null, syncingSince: null })
        synced += 1
      } else {
        updateEntry(entry.id, {
          status: 'failed',
          error: result.error ?? null,
          syncingSince: null,
        })
        failed += 1
      }
    } catch (error) {
      // A replay that threw client-side. The reason goes to the console; the
      // entry carries a code, because its text ends up on the screen.
      console.error('[sync]', error)
      updateEntry(entry.id, { status: 'failed', error: { code: 'unknown' }, syncingSince: null })
      failed += 1
    }
  }

  return { synced, failed, conflicts }
}

export function subscribeToQueue(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handleLocal = () => onChange()
  // Another tab wrote directly to storage; `read` notices via the raw string.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    onChange()
  }
  window.addEventListener('impasto:queue-changed', handleLocal)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener('impasto:queue-changed', handleLocal)
    window.removeEventListener('storage', handleStorage)
  }
}
