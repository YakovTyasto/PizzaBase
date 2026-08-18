'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getRepository } from '@/lib/data'

/**
 * Saves how a cook actually went.
 *
 * The session's id is derived from the recipe and the moment it started, so
 * the offline queue can replay it without producing a second record of the
 * same evening -- the same idempotency the import path uses, for the same
 * reason.
 */

const resultSchema = z.object({
  id: z.string().trim().min(1).max(200),
  recipeId: z.string().trim().min(1).max(200),
  recipeSlug: z.string().trim().min(1).max(200),
  versionId: z.string().trim().max(200).nullable().default(null),
  scaleFactor: z.string().trim().max(40).default('1'),
  startedAt: z.string().trim().max(40),
  finishedAt: z.string().trim().max(40).nullable().default(null),
  rating: z.number().int().min(1).max(5).nullable().default(null),
  tasteRating: z.number().int().min(1).max(5).nullable().default(null),
  crustRating: z.number().int().min(1).max(5).nullable().default(null),
  handlingRating: z.number().int().min(1).max(5).nullable().default(null),
  actualActiveMinutes: z.number().int().min(0).max(100000).nullable().default(null),
  actualPassiveMinutes: z.number().int().min(0).max(100000).nullable().default(null),
  notes: z.string().trim().max(4000).nullable().default(null),
  nextTime: z.string().trim().max(4000).nullable().default(null),
  completedStepIds: z.array(z.string().max(200)).max(200).default([]),
  media: z
    .array(
      z.object({
        id: z.string().max(100),
        storagePath: z.string().max(500).nullable(),
        alt: z.string().max(500).default(''),
      }),
    )
    .max(8)
    .default([]),
})

export type SaveCookResult = { ok: true; id: string } | { ok: false; error: string }

export async function saveCookResultAction(input: unknown): Promise<SaveCookResult> {
  const parsed = resultSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'That result is not valid' }
  }

  const result = parsed.data

  try {
    await getRepository().saveCookSession({
      id: result.id,
      recipeId: result.recipeId,
      recipeName: { value: result.recipeSlug, fallbackFrom: null },
      versionId: result.versionId,
      versionNumber: null,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      scaleFactor: result.scaleFactor,
      rating: result.rating,
      tasteRating: result.tasteRating,
      crustRating: result.crustRating,
      handlingRating: result.handlingRating,
      actualActiveMinutes: result.actualActiveMinutes,
      actualPassiveMinutes: result.actualPassiveMinutes,
      nextTime: result.nextTime,
      notes: result.notes,
      completedStepIds: result.completedStepIds,
      media: result.media.map((photo, index) => ({
        id: photo.id,
        url: null,
        alt: photo.alt || null,
        isCover: index === 0,
        storagePath: photo.storagePath,
      })),
    })

    revalidatePath('/', 'layout')
    return { ok: true, id: result.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The result could not be saved',
    }
  }
}
