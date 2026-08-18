// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSynced,
  enqueue,
  flushQueue,
  listQueue,
  pendingCount,
  removeEntry,
  updateEntry,
} from './queue'

describe('offline mutation queue', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('queues a draft and reports it as pending', () => {
    enqueue('recipe-draft', 'sauce-1', { name: 'Sauce' })
    expect(pendingCount()).toBe(1)
    expect(listQueue()[0]?.status).toBe('pending')
  })

  it('replaces an earlier edit of the same subject rather than stacking', () => {
    enqueue('recipe-draft', 'sauce-1', { name: 'First' })
    enqueue('recipe-draft', 'sauce-1', { name: 'Second' })

    const entries = listQueue()
    expect(entries).toHaveLength(1)
    expect((entries[0]?.payload as { name: string }).name).toBe('Second')
  })

  it('keeps separate subjects apart', () => {
    enqueue('recipe-draft', 'sauce-1', {})
    enqueue('recipe-draft', 'sauce-2', {})
    enqueue('cook-session', 'sauce-1', {})
    expect(listQueue()).toHaveLength(3)
  })

  it('replays oldest first and marks entries synced', async () => {
    const order: string[] = []
    enqueue('recipe-draft', 'a', { id: 'a' })
    // Ensure a distinct timestamp so ordering is deterministic.
    await new Promise((resolve) => setTimeout(resolve, 2))
    enqueue('recipe-draft', 'b', { id: 'b' })

    const result = await flushQueue({
      'recipe-draft': async (payload) => {
        order.push((payload as { id: string }).id)
        return { ok: true }
      },
      'cook-session': async () => ({ ok: true }),
    })

    expect(order).toEqual(['a', 'b'])
    expect(result.synced).toBe(2)
    expect(pendingCount()).toBe(0)
  })

  it('carries a stable idempotency key through a retry', async () => {
    const seen: string[] = []
    enqueue('recipe-draft', 'stable-key', { v: 1 })

    const handler = {
      'recipe-draft': async () => {
        seen.push(listQueue()[0]!.idempotencyKey)
        return { ok: false, error: 'network' }
      },
      'cook-session': async () => ({ ok: true }),
    }

    await flushQueue(handler)
    await flushQueue(handler)

    // The same key both times: a replay the server already applied is
    // recognised rather than duplicated.
    expect(seen).toEqual(['stable-key', 'stable-key'])
    expect(listQueue()[0]?.attempts).toBe(2)
  })

  it('marks a failure without losing the local copy', async () => {
    enqueue('recipe-draft', 'a', { name: 'Mine' })

    await flushQueue({
      'recipe-draft': async () => ({ ok: false, error: 'offline' }),
      'cook-session': async () => ({ ok: true }),
    })

    const entry = listQueue()[0]!
    expect(entry.status).toBe('failed')
    expect(entry.error).toBe('offline')
    expect((entry.payload as { name: string }).name).toBe('Mine')
  })

  it('parks a conflict instead of overwriting the server', async () => {
    enqueue('recipe-draft', 'a', { name: 'Mine' })

    const result = await flushQueue({
      'recipe-draft': async () => ({ ok: false, conflict: true, error: 'changed on server' }),
      'cook-session': async () => ({ ok: true }),
    })

    expect(result.conflicts).toBe(1)
    const entry = listQueue()[0]!
    expect(entry.status).toBe('conflict')
    // The local copy is still here for the owner to choose from.
    expect((entry.payload as { name: string }).name).toBe('Mine')
  })

  it('stops replaying after a conflict', async () => {
    const handled: string[] = []
    enqueue('recipe-draft', 'a', { id: 'a' })
    await new Promise((resolve) => setTimeout(resolve, 2))
    enqueue('recipe-draft', 'b', { id: 'b' })

    await flushQueue({
      'recipe-draft': async (payload) => {
        const id = (payload as { id: string }).id
        handled.push(id)
        return id === 'a' ? { ok: false, conflict: true } : { ok: true }
      },
      'cook-session': async () => ({ ok: true }),
    })

    // 'b' is not applied on top of an unresolved decision about 'a'.
    expect(handled).toEqual(['a'])
  })

  it('hands the idempotency key to the handler so a replay can be recognised', async () => {
    const seen: unknown[] = []
    enqueue('recipe-draft', 'sauce-1', { name: 'Sauce' })

    await flushQueue({
      'recipe-draft': async (payload, key) => {
        seen.push(key)
        return { ok: true }
      },
      'cook-session': async () => ({ ok: true }),
    })

    expect(seen).toEqual(['sauce-1'])
  })

  it('never replays the same entry from two overlapping flushes', async () => {
    let calls = 0
    enqueue('recipe-draft', 'a', { id: 'a' })

    const handlers = {
      'recipe-draft': async () => {
        calls += 1
        // Still in flight when the second flush starts.
        await new Promise((resolve) => setTimeout(resolve, 20))
        return { ok: true }
      },
      'cook-session': async () => ({ ok: true }),
    }

    const [first, second] = await Promise.all([flushQueue(handlers), flushQueue(handlers)])

    // Saving a new recipe twice would create two of it.
    expect(calls).toBe(1)
    expect(first.synced + second.synced).toBe(1)
  })

  it('picks up an entry a closed tab left mid-flight', async () => {
    const entry = enqueue('recipe-draft', 'a', { name: 'Mine' })
    // What a navigation during the request leaves behind.
    updateEntry(entry.id, { status: 'syncing' })

    const result = await flushQueue({
      'recipe-draft': async () => ({ ok: true }),
      'cook-session': async () => ({ ok: true }),
    })

    // Retried rather than stranded -- the idempotency key makes that safe.
    expect(result.synced).toBe(1)
    expect(listQueue()[0]?.status).toBe('synced')
  })

  it('recovers from a corrupted queue rather than throwing', () => {
    window.localStorage.setItem('impasto:mutation-queue', 'not json')
    expect(listQueue()).toEqual([])
    expect(() => enqueue('recipe-draft', 'a', {})).not.toThrow()
  })

  it('clears synced entries but keeps the rest', async () => {
    enqueue('recipe-draft', 'a', {})
    await flushQueue({
      'recipe-draft': async () => ({ ok: true }),
      'cook-session': async () => ({ ok: true }),
    })
    enqueue('recipe-draft', 'b', {})

    clearSynced()
    const entries = listQueue()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.idempotencyKey).toBe('b')
  })

  it('supports removing and updating a single entry', () => {
    const entry = enqueue('recipe-draft', 'a', {})
    updateEntry(entry.id, { status: 'synced' })
    expect(listQueue()[0]?.status).toBe('synced')
    removeEntry(entry.id)
    expect(listQueue()).toHaveLength(0)
  })

  it('returns a stable reference while nothing changes', () => {
    // useSyncExternalStore would spin forever on a fresh array each call.
    enqueue('recipe-draft', 'a', {})
    expect(listQueue()).toBe(listQueue())
  })

  it('notifies subscribers when the queue changes', () => {
    const spy = vi.fn()
    window.addEventListener('impasto:queue-changed', spy)
    enqueue('recipe-draft', 'a', {})
    expect(spy).toHaveBeenCalled()
    window.removeEventListener('impasto:queue-changed', spy)
  })
})

/**
 * Reclaiming an attempt whose document went away.
 *
 * The regression: an entry was re-armed the moment any flush began, including
 * one whose request was still on the wire from a document a navigation had
 * just destroyed. Both attempts then reached the server, raced its idempotency
 * check, and produced two recipes from the one key meant to prevent that.
 */
describe('entries left in flight', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  it('does not replay an attempt that is still running', async () => {
    const entry = enqueue('recipe-draft', 'draft-1', { name: 'Sauce' })
    // Marked as a flush would mark it, moments ago.
    updateEntry(entry.id, { status: 'syncing', syncingSince: Date.now() - 500 })

    const handled: string[] = []
    await flushQueue({
      'recipe-draft': async (_payload, key) => {
        handled.push(key)
        return { ok: true }
      },
      'cook-session': async () => ({ ok: true }),
    })

    expect(handled).toEqual([])
    expect(listQueue()[0]?.status).toBe('syncing')
  })

  it('does replay one whose document is long gone', async () => {
    const entry = enqueue('recipe-draft', 'draft-1', { name: 'Sauce' })
    updateEntry(entry.id, { status: 'syncing', syncingSince: Date.now() - 60_000 })

    const handled: string[] = []
    await flushQueue({
      'recipe-draft': async (_payload, key) => {
        handled.push(key)
        return { ok: true }
      },
      'cook-session': async () => ({ ok: true }),
    })

    expect(handled).toEqual(['draft-1'])
    expect(listQueue()[0]?.status).toBe('synced')
  })

  it('treats an entry with no start time as abandoned', async () => {
    // Written by an older build, before the marker existed.
    const entry = enqueue('recipe-draft', 'draft-1', { name: 'Sauce' })
    updateEntry(entry.id, { status: 'syncing', syncingSince: null })

    const handled: string[] = []
    await flushQueue({
      'recipe-draft': async (_payload, key) => {
        handled.push(key)
        return { ok: true }
      },
      'cook-session': async () => ({ ok: true }),
    })

    expect(handled).toEqual(['draft-1'])
  })

  it('clears the start time on every terminal outcome', async () => {
    enqueue('recipe-draft', 'ok', { name: 'A' })
    await flushQueue({
      'recipe-draft': async () => ({ ok: true }),
      'cook-session': async () => ({ ok: true }),
    })
    expect(listQueue()[0]?.syncingSince).toBeNull()

    window.localStorage.clear()
    enqueue('recipe-draft', 'bad', { name: 'B' })
    await flushQueue({
      'recipe-draft': async () => ({ ok: false, error: { code: 'unknown' } }),
      'cook-session': async () => ({ ok: true }),
    })
    expect(listQueue()[0]?.status).toBe('failed')
    expect(listQueue()[0]?.syncingSince).toBeNull()
  })
})
