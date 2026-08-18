'use server'

import { Decimal } from 'decimal.js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { type Amount, ALL_UNITS, isQualitativeUnit, isUnit } from '@/domain'
import { getRepository } from '@/lib/data'
import { toActionError } from '@/lib/data/failure'
import type { ActionResult } from './plan'

const addSchema = z.object({
  ingredientId: z.string().min(1).max(200),
  quantity: z.string().min(1).max(20),
  unit: z.enum(ALL_UNITS as [string, ...string[]]),
  location: z.enum(['fridge', 'freezer', 'pantry']),
  expiresAt: z.string().max(30).nullable().optional(),
})

export async function addPantryItemAction(input: unknown): Promise<ActionResult> {
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation' } }
  }
  const { ingredientId, quantity, unit, location, expiresAt } = parsed.data
  if (!isUnit(unit)) return { ok: false, error: { code: 'validation' } }

  // A qualitative pantry entry ("some salt") cannot be deducted from anything,
  // so it is rejected here rather than silently ignored later.
  if (isQualitativeUnit(unit)) {
    return { ok: false, error: { code: 'validation' } }
  }

  let value: Decimal
  try {
    value = new Decimal(quantity.replace(',', '.'))
  } catch {
    return { ok: false, error: { code: 'validation' } }
  }
  if (!value.isFinite() || value.lessThanOrEqualTo(0)) {
    return { ok: false, error: { code: 'validation' } }
  }

  const amount: Amount = { kind: 'exact', value, unit }

  try {
    await getRepository().addPantryItem({
      ingredientId,
      amount,
      location,
      expiresAt: expiresAt || null,
    })
  } catch (error) {
    return { ok: false, error: toActionError(error, 'addPantryItem') }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function removePantryItemAction(id: string): Promise<ActionResult> {
  const parsed = z.string().min(1).max(200).safeParse(id)
  if (!parsed.success) return { ok: false, error: { code: 'validation' } }

  try {
    await getRepository().removePantryItem(parsed.data)
  } catch (error) {
    return { ok: false, error: toActionError(error, 'removePantryItem') }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
