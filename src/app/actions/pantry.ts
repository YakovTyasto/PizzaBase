'use server'

import { Decimal } from 'decimal.js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { type Amount, ALL_UNITS, isQualitativeUnit, isUnit } from '@/domain'
import { getRepository } from '@/lib/data'
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
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid pantry item' }
  }
  const { ingredientId, quantity, unit, location, expiresAt } = parsed.data
  if (!isUnit(unit)) return { ok: false, error: 'Unknown unit' }

  // A qualitative pantry entry ("some salt") cannot be deducted from anything,
  // so it is rejected here rather than silently ignored later.
  if (isQualitativeUnit(unit)) {
    return { ok: false, error: 'Pantry quantities need a measurable unit' }
  }

  let value: Decimal
  try {
    value = new Decimal(quantity.replace(',', '.'))
  } catch {
    return { ok: false, error: 'Quantity must be a number' }
  }
  if (!value.isFinite() || value.lessThanOrEqualTo(0)) {
    return { ok: false, error: 'Quantity must be greater than zero' }
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
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not add the item',
    }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function removePantryItemAction(id: string): Promise<ActionResult> {
  const parsed = z.string().min(1).max(200).safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid item' }

  try {
    await getRepository().removePantryItem(parsed.data)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not remove the item',
    }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
