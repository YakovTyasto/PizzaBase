import { describe, expect, it, vi } from 'vitest'
import { exact } from '@/domain'
import { DemoRepository } from './demo/repository'
import { ReadOnlyStoreError } from './errors'
import { toActionError } from './failure'

/**
 * The read-only demo, which is what a Vercel deployment without Supabase is.
 *
 * Every write is refused *before* any filesystem call, so there is nothing to
 * half-apply and no platform error message to leak. The tests below assert
 * both halves of that: the refusal happens, and what comes back is a code
 * rather than anything the runtime said.
 */

/** Reads still work: the seeded catalog is fully browsable without a session. */
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}))

const readOnly = () => new DemoRepository(false)
const writable = () => new DemoRepository(true)

describe('a read-only demo repository', () => {
  it('reports itself as not writable', () => {
    expect(readOnly().writable).toBe(false)
    expect(writable().writable).toBe(true)
  })

  it('still serves the whole catalog', async () => {
    const recipes = await readOnly().listRecipes('ru')
    expect(recipes.length).toBeGreaterThan(0)

    const recipe = await readOnly().getRecipe('ru', 'sisofo-forgotten-neapolitan')
    expect(recipe?.items.length).toBeGreaterThan(0)
  })

  it('refuses to add a pantry item', async () => {
    await expect(
      readOnly().addPantryItem({
        ingredientId: 'salt-sea',
        amount: exact(500, 'g'),
        location: 'pantry',
      }),
    ).rejects.toBeInstanceOf(ReadOnlyStoreError)
  })

  it('refuses to save a plan', async () => {
    await expect(
      readOnly().savePlan({
        id: 'demo-plan',
        serveAt: null,
        notes: null,
        entries: [
          {
            id: 'entry-1',
            recipeId: 'margherita-user',
            count: 1,
            shape: 'round',
            diameterMm: 300,
            trayWidthMm: null,
            trayHeightMm: null,
            ballWeightG: null,
            scaleMode: 'area',
            doughRecipeId: null,
            sauceRecipeId: null,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ReadOnlyStoreError)
  })

  it('refuses to change settings, delete a recipe or reset the demo', async () => {
    await expect(readOnly().saveSettings({ defaultBallWeightG: 300 })).rejects.toBeInstanceOf(
      ReadOnlyStoreError,
    )
    await expect(readOnly().deleteRecipe('margherita-user')).rejects.toBeInstanceOf(
      ReadOnlyStoreError,
    )
    await expect(readOnly().resetDemoData()).rejects.toBeInstanceOf(ReadOnlyStoreError)
  })

  it('leaves the catalog untouched after a refused write', async () => {
    const before = await readOnly().getPantry('ru')
    await readOnly()
      .addPantryItem({
        ingredientId: 'salt-sea',
        amount: exact(500, 'g'),
        location: 'pantry',
      })
      .catch(() => {})
    const after = await readOnly().getPantry('ru')

    expect(after).toEqual(before)
  })
})

describe('what a refused write tells the browser', () => {
  it('answers with a code, not a message', () => {
    expect(toActionError(new ReadOnlyStoreError(), 'test')).toEqual({ code: 'readonly' })
  })

  it('never forwards a filesystem error to the caller', () => {
    // Exactly the error the platform raised in production.
    const enoent = Object.assign(
      new Error("ENOENT: no such file or directory, mkdir '/var/task/.impasto-demo'"),
      { code: 'ENOENT' },
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = toActionError(enoent, 'test')

    expect(result).toEqual({ code: 'unknown' })
    expect(JSON.stringify(result)).not.toMatch(/var\/task|impasto-demo|ENOENT/)
    // The detail is not lost -- it goes to the server log, where it belongs.
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
