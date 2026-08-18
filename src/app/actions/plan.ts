'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getRepository } from '@/lib/data'
import type { ActionError } from '@/lib/data/errors'
import { toActionError } from '@/lib/data/failure'
import type { PlanEntry } from '@/lib/data/types'

/**
 * Plan mutations.
 *
 * Input is validated here rather than trusted from the form: a Server Action is
 * a public endpoint, and `count` arriving as "-3" or as a 10 000-pizza typo
 * should be rejected at the boundary.
 */

const entrySchema = z.object({
  id: z.string().min(1),
  recipeId: z.string().min(1).max(200),
  count: z.number().int().min(1).max(99),
  shape: z.enum(['round', 'rectangular']),
  diameterMm: z.number().int().min(100).max(800).nullable(),
  trayWidthMm: z.number().int().min(50).max(2000).nullable(),
  trayHeightMm: z.number().int().min(50).max(2000).nullable(),
  ballWeightG: z.string().nullable(),
  scaleMode: z.enum(['area', 'portion']),
  doughRecipeId: z.string().nullable(),
  sauceRecipeId: z.string().nullable(),
})

const planSchema = z.object({
  id: z.string(),
  serveAt: z.string().nullable(),
  notes: z.string().max(2000).nullable(),
  entries: z.array(entrySchema).max(50),
})

/**
 * What every mutation answers.
 *
 * The failure side carries a code, never a message from the server: see
 * `lib/data/errors.ts` for why.
 */
export type ActionResult = { ok: true } | { ok: false; error: ActionError }

export async function savePlanAction(input: unknown): Promise<ActionResult> {
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation' } }
  }

  try {
    await getRepository().savePlan(parsed.data)
  } catch (error) {
    return { ok: false, error: toActionError(error, 'savePlan') }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function addToPlanAction(recipeId: string): Promise<ActionResult> {
  const id = z.string().min(1).max(200).safeParse(recipeId)
  if (!id.success) return { ok: false, error: { code: 'validation' } }

  const repository = getRepository()
  const plan = await repository.getPlan()

  // Adding a recipe that is already planned bumps its count rather than
  // creating a second row for the same pizza.
  const existing = plan.entries.find((entry) => entry.recipeId === id.data)
  const entries: PlanEntry[] = existing
    ? plan.entries.map((entry) =>
        entry.recipeId === id.data ? { ...entry, count: Math.min(99, entry.count + 1) } : entry,
      )
    : [
        ...plan.entries,
        {
          id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          recipeId: id.data,
          count: 1,
          shape: 'round' as const,
          diameterMm: 300,
          trayWidthMm: null,
          trayHeightMm: null,
          ballWeightG: null,
          scaleMode: 'area' as const,
          doughRecipeId: null,
          sauceRecipeId: null,
        },
      ]

  return savePlanAction({ ...plan, entries })
}
