'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getRepository } from '@/lib/data'

/**
 * Restores an earlier version.
 *
 * Restoring is itself a change, so the version being replaced is snapshotted
 * first: going back never destroys the state you are going back from.
 */
export async function makeVersionPrimaryAction(
  versionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.string().min(1).max(200).safeParse(versionId)
  if (!parsed.success) return { ok: false, error: 'Invalid version' }

  try {
    await getRepository().makeVersionPrimary(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The version could not be restored',
    }
  }
}
