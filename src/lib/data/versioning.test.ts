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
