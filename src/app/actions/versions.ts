'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getRepository } from '@/lib/data'
import type { ActionError } from '@/lib/data/errors'
import { toActionError } from '@/lib/data/failure'

/**
 * Restores an earlier version.
 *
 * Restoring is itself a change, so the version being replaced is snapshotted
 * first: going back never destroys the state you are going back from.
 */
export async function makeVersionPrimaryAction(
  versionId: string,
): Promise<{ ok: true } | { ok: false; error: ActionError }> {
  const parsed = z.string().min(1).max(200).safeParse(versionId)
  if (!parsed.success) return { ok: false, error: { code: 'validation' } }

  try {
    await getRepository().makeVersionPrimary(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error, 'makeVersionPrimary') }
  }
}
