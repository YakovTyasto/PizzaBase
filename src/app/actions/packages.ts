'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Unit } from '@/domain'
import { getRepository } from '@/lib/data'

/**
 * Remembers a package size the owner confirmed from a real label.
 *
 * This is the answer to the question the review screen otherwise has to keep
 * asking: a sauce yields what its can actually holds, and the can in the
 * owner's cupboard is the only authority on that. Nothing is stored unless
 * they tick the box after reading what was recognised.
 */

const schema = z.object({
  ingredientId: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().regex(/^\d+([.,]\d+)?$/, 'That is not a quantity'),
  unit: z.enum(['mg', 'g', 'kg', 'ml', 'l', 'piece']),
  barcode: z.string().trim().max(40).nullable().default(null),
})

export type RememberPackageResult = { ok: true; id: string } | { ok: false; error: string }

export async function rememberPackageAction(input: unknown): Promise<RememberPackageResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'That package is not valid' }
  }

  try {
    const result = await getRepository().addPackageOption({
      ingredientId: parsed.data.ingredientId,
      label: parsed.data.label,
      value: parsed.data.value.replace(',', '.'),
      unit: parsed.data.unit as Unit,
      barcode: parsed.data.barcode,
    })
    revalidatePath('/', 'layout')
    return { ok: true, id: result.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The package size could not be saved',
    }
  }
}
