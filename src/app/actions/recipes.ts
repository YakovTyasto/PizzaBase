'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getRepository } from '@/lib/data'
import { RepositoryError } from '@/lib/data/demo/repository'
import {
  type DraftValidationIssue,
  type RecipeDraft,
  recipeDraftSchema,
  validateDraft,
} from '@/lib/data/recipe-draft'
import type { LOCALE_KEYS } from '@/lib/data/recipe-draft'

/**
 * Recipe authoring actions.
 *
 * The draft is re-parsed and re-validated here even though the editor already
 * checked it: a Server Action is a public endpoint, and the client's copy of
 * the rules is a convenience, never the enforcement.
 */

export type SaveResult =
  | { ok: true; slug: string; created: boolean; versionCreated: boolean }
  | { ok: false; error: string; issues?: DraftValidationIssue[]; cycle?: string[] }

export async function saveRecipeAction(input: unknown): Promise<SaveResult> {
  const parsed = recipeDraftSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'The recipe could not be saved',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }

  const issues = validateDraft(parsed.data)
  if (issues.length > 0) {
    return { ok: false, error: 'Please fix the highlighted fields', issues }
  }

  try {
    const result = await getRepository().saveRecipe(parsed.data)
    // The library, the recipe page and anything that expands this recipe as a
    // component all need to reflect the change.
    revalidatePath('/', 'layout')
    return {
      ok: true,
      slug: result.slug,
      created: result.created,
      versionCreated: result.versionCreated,
    }
  } catch (error) {
    if (error instanceof RepositoryError) {
      if (error.code === 'cycle') {
        return {
          ok: false,
          error: 'A recipe cannot contain itself',
          cycle: error.details as string[],
        }
      }
      if (error.code === 'validation') {
        return {
          ok: false,
          error: 'Please fix the highlighted fields',
          issues: error.details as DraftValidationIssue[],
        }
      }
      return { ok: false, error: error.message }
    }
    // A database constraint firing here (the cycle trigger, a missing
    // ingredient) means nothing was written, so the message can be plain.
    const message = error instanceof Error ? error.message : 'The recipe could not be saved'
    return {
      ok: false,
      error: /cycle/i.test(message) ? 'A recipe cannot contain itself' : message,
    }
  }
}

export async function deleteRecipeAction(slug: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.string().min(1).max(200).safeParse(slug)
  if (!parsed.success) return { ok: false, error: 'Invalid recipe' }

  try {
    await getRepository().deleteRecipe(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The recipe could not be deleted',
    }
  }
}

const createIngredientSchema = z.object({
  names: z.object({
    ru: z.string().trim().max(200),
    en: z.string().trim().max(200),
    fr: z.string().trim().max(200),
  }),
  categorySlug: z.string().trim().min(1).max(120),
  measure: z.enum(['mass', 'volume', 'count', 'package', 'qualitative']),
  baseUnit: z.string().trim().min(1).max(40),
  aliases: z.array(z.string().trim().max(120)).max(20).optional(),
})

export async function createIngredientAction(
  input: unknown,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const parsed = createIngredientSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid ingredient' }
  }
  if (
    !parsed.data.names.ru.trim() &&
    !parsed.data.names.en.trim() &&
    !parsed.data.names.fr.trim()
  ) {
    return { ok: false, error: 'An ingredient needs a name' }
  }

  try {
    const slug = await getRepository().createIngredient({
      names: parsed.data.names,
      categorySlug: parsed.data.categorySlug,
      measure: parsed.data.measure,
      baseUnit: parsed.data.baseUnit as never,
      aliases: parsed.data.aliases,
    })
    revalidatePath('/', 'layout')
    return { ok: true, slug }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The ingredient could not be created',
    }
  }
}

/**
 * Answers one open question without opening the full editor.
 *
 * The point of the Needs-review screen is that fixing a single field updates
 * every dependent calculation, so this loads the draft, changes exactly one
 * thing, and saves it back through the same validated path as the editor.
 */
const resolutionSchema = z.object({
  recipeSlug: z.string().trim().min(1).max(200),
  field: z.string().trim().min(1).max(120),
  itemKey: z.string().trim().max(80).nullable().default(null),
  amount: z
    .object({
      kind: z.enum(['exact', 'range', 'qualitative', 'unknown']),
      value: z.string().trim().max(24).optional(),
      min: z.string().trim().max(24).optional(),
      max: z.string().trim().max(24).optional(),
      unit: z.string().trim().max(40).optional(),
    })
    .nullable()
    .default(null),
  /** For the "which ingredient is this?" question. */
  ingredientSlug: z.string().trim().max(200).nullable().default(null),
  /** For a yield question. */
  baseYield: z.string().trim().max(24).nullable().default(null),
  yieldUnit: z.string().trim().max(40).nullable().default(null),
  /** Marks the evidence row confirmed once the owner has decided. */
  confirm: z.boolean().default(true),
})

export async function resolveQuestionAction(input: unknown): Promise<SaveResult> {
  const parsed = resolutionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid answer' }
  }
  const answer = parsed.data

  const repository = getRepository()
  const draft = await repository.getRecipeDraft(answer.recipeSlug)
  if (!draft) return { ok: false, error: 'That recipe no longer exists' }

  const next: RecipeDraft = structuredClone(draft)

  if (answer.itemKey && answer.amount) {
    const item = next.items.find((candidate) => candidate.key === answer.itemKey)
    if (!item) return { ok: false, error: 'That ingredient is no longer in the recipe' }
    const amount = toDraftAmount(answer.amount)
    if (!amount) return { ok: false, error: 'That amount is not valid' }
    item.amount = amount
  }

  if (answer.itemKey && answer.ingredientSlug) {
    const item = next.items.find((candidate) => candidate.key === answer.itemKey)
    if (item) {
      item.ingredientSlug = answer.ingredientSlug
      item.componentSlug = null
    }
  }

  if (answer.field === 'recipe.baseYield' && answer.baseYield) {
    next.baseYield = answer.baseYield
    next.yieldUnit = (answer.yieldUnit ?? next.yieldUnit ?? 'g') as RecipeDraft['yieldUnit']
  }

  // Mark the matching evidence resolved. A confirmed answer is the owner's
  // decision, so the flag moves to `confirmed` rather than being dropped --
  // the note explaining what was in doubt is worth keeping.
  if (answer.confirm) {
    for (const evidence of next.evidence) {
      const matchesField = evidence.field === answer.field
      const matchesItem = (evidence.itemKey ?? null) === (answer.itemKey ?? null)
      if (matchesField && matchesItem) {
        evidence.reviewState = 'confirmed'
        evidence.confidence = 1
      }
    }
  }

  return saveRecipeAction(next)
}

function toDraftAmount(
  input: NonNullable<z.infer<typeof resolutionSchema>['amount']>,
): RecipeDraft['items'][number]['amount'] | null {
  switch (input.kind) {
    case 'exact':
      if (!input.value || !input.unit) return null
      return { kind: 'exact', value: input.value, unit: input.unit }
    case 'range':
      if (!input.min || !input.max || !input.unit) return null
      return { kind: 'range', min: input.min, max: input.max, unit: input.unit }
    case 'qualitative':
      if (!input.unit) return null
      return { kind: 'qualitative', unit: input.unit }
    case 'unknown':
      return { kind: 'unknown' }
  }
}

export type { LOCALE_KEYS }
