'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getRepository } from '@/lib/data'
import type { ActionError } from '@/lib/data/errors'
import { toActionError } from '@/lib/data/failure'

/**
 * Experiments: two or more versions, what changed between them, and which one
 * won. The comparison itself is arithmetic done elsewhere; this only stores
 * the owner's reading of it.
 */

const saveSchema = z.object({
  id: z.string().trim().max(200).nullable().default(null),
  recipeSlug: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).default(''),
  versionIds: z.array(z.string().max(200)).min(2).max(6),
  sessionIds: z.array(z.string().max(200)).max(20).default([]),
  hypothesis: z.string().trim().max(2000).nullable().default(null),
  conclusion: z.string().trim().max(2000).nullable().default(null),
  winningVersionId: z.string().trim().max(200).nullable().default(null),
})

export type SaveExperimentResult = { ok: true; id: string } | { ok: false; error: ActionError }

export async function saveExperimentAction(input: unknown): Promise<SaveExperimentResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation' } }
  }

  // A winner has to be one of the versions being compared, or the record would
  // point at something the experiment never looked at.
  if (
    parsed.data.winningVersionId &&
    !parsed.data.versionIds.includes(parsed.data.winningVersionId)
  ) {
    return { ok: false, error: { code: 'validation' } }
  }

  try {
    const result = await getRepository().saveExperiment(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true, id: result.id }
  } catch (error) {
    return { ok: false, error: toActionError(error, 'saveExperiment') }
  }
}

export async function deleteExperimentAction(id: unknown): Promise<{ ok: boolean }> {
  const parsed = z.string().min(1).max(200).safeParse(id)
  if (!parsed.success) return { ok: false }

  try {
    await getRepository().deleteExperiment(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
