import { Decimal } from 'decimal.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Version snapshots, which are what an experiment compares.
 *
 * The defect: snapshots were only taken when a recipe's status was already
 * `verified`. Nothing in the seeded catalog is verified, so editing never
 * produced a single historical version and the Experiments screen could only
 * ever say "two versions needed" -- for every recipe in the library.
 */

const SESSION = 'testsessionversioning'

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'impasto_demo_session' ? { value: SESSION } : undefined),
    set: () => {},
    delete: () => {},
  }),
}))

let dataDir: string

beforeAll(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'impasto-versions-'))
  process.env.IMPASTO_DEMO_DIR = dataDir
})

afterAll(() => {
  delete process.env.IMPASTO_DEMO_DIR
  rmSync(dataDir, { recursive: true, force: true })
})

/** Imported after the data directory is set, since the overlay reads it once. */
async function freshRepository() {
  vi.resetModules()
  const { DemoRepository } = await import('./demo/repository')
  return new DemoRepository(true)
}

describe('editing a recipe creates exactly one snapshot', () => {
  beforeEach(() => {
    rmSync(path.join(dataDir, `${SESSION}.json`), { force: true })
  })

  it('snapshots the seeded original the first time a recipe is changed', async () => {
    const repository = await freshRepository()
    const slug = 'sisofo-forgotten-neapolitan'
    const original = (await repository.getRecipeDraft(slug))!
    // The point: this is not a verified recipe, and it still gets a version.
    expect(original.status).not.toBe('verified')

    const first = await repository.saveRecipe({ ...original, difficulty: 4 })
    expect(first.versionCreated).toBe(true)

    const versions = await repository.listVersions(slug)
    expect(versions).toHaveLength(1)
    expect(versions[0]?.versionNumber).toBe(1)

    // The snapshot holds the recipe as the source shipped it.
    const snapshot = await repository.getVersionDraft(versions[0]!.id)
    expect(snapshot?.difficulty).toBe(original.difficulty)
    expect(original.difficulty).not.toBe(4)
  })

  it('creates one further snapshot per further change', async () => {
    const repository = await freshRepository()
    const slug = 'sisofo-forgotten-neapolitan'

    await repository.saveRecipe({ ...(await repository.getRecipeDraft(slug))!, difficulty: 4 })
    const second = await repository.saveRecipe({
      ...(await repository.getRecipeDraft(slug))!,
      difficulty: 5,
    })

    expect(second.versionCreated).toBe(true)
    expect(await repository.listVersions(slug)).toHaveLength(2)
  })

  it('does not add a second identical snapshot when nothing changed', async () => {
    const repository = await freshRepository()
    const slug = 'sisofo-forgotten-neapolitan'

    await repository.saveRecipe({ ...(await repository.getRecipeDraft(slug))!, difficulty: 4 })
    expect(await repository.listVersions(slug)).toHaveLength(1)

    // Saving the same content again is not a new version of anything.
    const unchanged = await repository.saveRecipe((await repository.getRecipeDraft(slug))!)
    expect(unchanged.versionCreated).toBe(false)
    expect(await repository.listVersions(slug)).toHaveLength(1)

    // Even an explicit request must not duplicate the latest snapshot.
    const forced = await repository.saveRecipe({
      ...(await repository.getRecipeDraft(slug))!,
      createVersion: true,
    })
    expect(forced.versionCreated).toBe(false)
    expect(await repository.listVersions(slug)).toHaveLength(1)
  })

  it('accumulates one version per distinct change', async () => {
    const repository = await freshRepository()
    const slug = 'sisofo-forgotten-neapolitan'

    for (const difficulty of [4, 5, 3, 2] as const) {
      await repository.saveRecipe({
        ...(await repository.getRecipeDraft(slug))!,
        difficulty,
      })
    }

    // Newest first, which is the order the versions screen reads them in.
    const versions = await repository.listVersions(slug)
    expect(versions).toHaveLength(4)
    expect(versions.map((version) => version.versionNumber)).toEqual([4, 3, 2, 1])
  })

  it('keeps the snapshot readable as a draft, so it can be compared', async () => {
    const repository = await freshRepository()
    const slug = 'sisofo-forgotten-neapolitan'

    await repository.saveRecipe({ ...(await repository.getRecipeDraft(slug))!, difficulty: 4 })
    await repository.saveRecipe({ ...(await repository.getRecipeDraft(slug))!, difficulty: 5 })

    const [latest] = await repository.listVersions(slug)
    const snapshot = await repository.getVersionDraft(latest!.id)

    expect(snapshot).not.toBeNull()
    expect(snapshot!.difficulty).toBe(4)
    expect((await repository.getRecipeDraft(slug))!.difficulty).toBe(5)
  })
})

describe('a read-only deployment cannot create versions at all', () => {
  it('refuses the save rather than pretending a snapshot was taken', async () => {
    vi.resetModules()
    const { DemoRepository } = await import('./demo/repository')
    const { ReadOnlyStoreError } = await import('./errors')
    const repository = new DemoRepository(false)

    const draft = (await repository.getRecipeDraft('sisofo-forgotten-neapolitan'))!
    await expect(repository.saveRecipe({ ...draft, difficulty: 4 })).rejects.toBeInstanceOf(
      ReadOnlyStoreError,
    )
  })
})

/**
 * The idempotency ledger, under concurrency.
 *
 * A queued offline draft can be replayed twice -- a navigation mid-request
 * leaves one attempt on the wire while the next document starts another. The
 * key exists so that produces one recipe. Reading the ledger and then writing
 * left a window between the two in which both attempts saw the key unused, so
 * arbitration now happens in a single claim.
 */
describe('claiming an idempotency key', () => {
  beforeEach(() => {
    rmSync(path.join(dataDir, `${SESSION}.json`), { force: true })
  })

  it('is acquired by exactly one of two concurrent callers', async () => {
    const repository = await freshRepository()

    const [first, second] = await Promise.all([
      repository.claimMutation('draft-key'),
      repository.claimMutation('draft-key'),
    ])

    expect([first.acquired, second.acquired].filter(Boolean)).toHaveLength(1)
    // The loser is told there is no result yet, rather than being waved through.
    const loser = first.acquired ? second : first
    expect(loser.slug).toBeNull()
  })

  it('hands later callers the slug once the winner records it', async () => {
    const repository = await freshRepository()

    expect((await repository.claimMutation('draft-key')).acquired).toBe(true)
    await repository.recordAppliedMutation('draft-key', 'sisofo-forgotten-neapolitan')

    const again = await repository.claimMutation('draft-key')
    expect(again.acquired).toBe(false)
    expect(again.slug).toBe('sisofo-forgotten-neapolitan')
    expect(await repository.findAppliedMutation('draft-key')).toBe('sisofo-forgotten-neapolitan')
  })

  it('reads a claim that has not finished as unused', async () => {
    const repository = await freshRepository()
    await repository.claimMutation('draft-key')

    // A claim is not a result: nothing was written under this key yet.
    expect(await repository.findAppliedMutation('draft-key')).toBeNull()
  })

  it('gives the key back when the write it guarded failed', async () => {
    const repository = await freshRepository()

    expect((await repository.claimMutation('draft-key')).acquired).toBe(true)
    await repository.releaseMutation('draft-key')

    expect((await repository.claimMutation('draft-key')).acquired).toBe(true)
  })

  it('never releases a key that already recorded a recipe', async () => {
    const repository = await freshRepository()

    await repository.claimMutation('draft-key')
    await repository.recordAppliedMutation('draft-key', 'sisofo-forgotten-neapolitan')
    await repository.releaseMutation('draft-key')

    expect(await repository.findAppliedMutation('draft-key')).toBe('sisofo-forgotten-neapolitan')
  })

  it('lets the key be reused when its recipe has since been deleted', async () => {
    const repository = await freshRepository()

    await repository.claimMutation('draft-key')
    await repository.recordAppliedMutation('draft-key', 'recipe-that-never-existed')

    // Pointing at nothing is worse than being unused: the owner can save again.
    const again = await repository.claimMutation('draft-key')
    expect(again.acquired).toBe(true)
  })
})

/**
 * Concurrent overlay writes.
 *
 * `updateOverlay` reads, changes and writes back with an await on each end, so
 * two requests for one session used to interleave and the second silently
 * discarded whatever the first had added.
 */
describe('two writes to one session', () => {
  beforeEach(() => {
    rmSync(path.join(dataDir, `${SESSION}.json`), { force: true })
  })

  it('keeps both, rather than losing the first', async () => {
    const repository = await freshRepository()

    await Promise.all([
      repository.addPantryItem({
        ingredientId: 'salt-sea',
        amount: { kind: 'exact', value: new Decimal(500), unit: 'g' },
        location: 'pantry',
      }),
      repository.addPantryItem({
        ingredientId: 'flour-type-00',
        amount: { kind: 'exact', value: new Decimal(1000), unit: 'g' },
        location: 'pantry',
      }),
    ])

    const pantry = await repository.getPantry('ru')
    expect(pantry.map((item) => item.ingredientId).sort()).toEqual(['flour-type-00', 'salt-sea'])
  })
})
