'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getRepository } from '@/lib/data'
import { RepositoryError } from '@/lib/data/demo/repository'
import type { ActionError } from '@/lib/data/errors'
import { toActionError } from '@/lib/data/failure'
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
  | { ok: false; error: ActionError; issues?: DraftValidationIssue[]; cycle?: string[] }

/**
 * Waits, briefly, for the caller holding a key to finish.
 *
 * The loser of a claim is a *replay*, not a second edit, so the useful answer
 * is the winner's slug rather than an error. Polling for a couple of seconds
 * covers the case that matters -- two replays of the same queued draft, moments
 * apart -- without turning a genuinely stuck write into an indefinite wait.
 */
async function waitForMutation(
  repository: { findAppliedMutation(key: string): Promise<string | null> },
  key: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    const slug = await repository.findAppliedMutation(key)
    if (slug) return slug
  }
  return null
}

/**
 * Saves a draft.
 *
 * `idempotencyKey` is optional and used by the two callers that can legitimately
 * submit the same write twice: an approved import, and a queued offline draft
 * whose response was lost before the client saw it. When a key has already been
 * applied, the recipe it produced is returned instead of a second one being
 * created.
 */
export async function saveRecipeAction(
  input: unknown,
  idempotencyKey?: string,
): Promise<SaveResult> {
  const parsed = recipeDraftSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'validation' },
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }

  const issues = validateDraft(parsed.data)
  if (issues.length > 0) {
    return { ok: false, error: { code: 'validation' }, issues }
  }

  const key = typeof idempotencyKey === 'string' ? idempotencyKey.slice(0, 200) : null

  try {
    const repository = getRepository()

    if (key) {
      // Claimed, not merely checked. Reading the ledger and then writing left a
      // window in which two replays of the same queued draft both saw the key
      // unused; both wrote, and the second was given a fresh slug by the
      // uniqueness check. One key, two recipes -- exactly what it was meant to
      // prevent. Only one caller can acquire it.
      const claim = await repository.claimMutation(key)
      if (!claim.acquired) {
        const settled = claim.slug ?? (await waitForMutation(repository, key))
        // This exact write already landed; point at what it produced.
        if (settled) return { ok: true, slug: settled, created: false, versionCreated: false }
        // Still in flight after the wait. Reporting failure lets the caller
        // retry, which is safe; writing alongside it would not be.
        return { ok: false, error: { code: 'conflict' } }
      }
    }

    let result
    try {
      result = await repository.saveRecipe(parsed.data)
    } catch (error) {
      // Give the key back, or a save that failed for any reason would lock out
      // every later attempt at the same draft.
      if (key) await repository.releaseMutation(key).catch(() => {})
      throw error
    }
    // Recorded only after the recipe genuinely exists, so a failed save can be
    // retried rather than being permanently treated as done.
    if (key) await repository.recordAppliedMutation(key, result.slug)
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
        return { ok: false, error: { code: 'cycle' }, cycle: error.details as string[] }
      }
      if (error.code === 'validation') {
        return {
          ok: false,
          error: { code: 'validation' },
          issues: error.details as DraftValidationIssue[],
        }
      }
      return { ok: false, error: toActionError(error, 'saveRecipe') }
    }
    // A database constraint firing here (the cycle trigger, a missing
    // ingredient) means nothing was written. The trigger's own message is the
    // only thing that distinguishes a cycle from any other constraint, so it is
    // matched here and then discarded rather than shown.
    if (error instanceof Error && /cycle/i.test(error.message)) {
      return { ok: false, error: { code: 'cycle' } }
    }
    return { ok: false, error: toActionError(error, 'saveRecipe') }
  }
}

export async function deleteRecipeAction(
  slug: string,
): Promise<{ ok: true } | { ok: false; error: ActionError }> {
  const parsed = z.string().min(1).max(200).safeParse(slug)
  if (!parsed.success) return { ok: false, error: { code: 'validation' } }

  try {
    await getRepository().deleteRecipe(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: toActionError(error, 'deleteRecipe') }
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
): Promise<{ ok: true; slug: string } | { ok: false; error: ActionError }> {
  const parsed = createIngredientSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation' } }
  }
  if (
    !parsed.data.names.ru.trim() &&
    !parsed.data.names.en.trim() &&
    !parsed.data.names.fr.trim()
  ) {
    return { ok: false, error: { code: 'validation' } }
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
    return { ok: false, error: toActionError(error, 'createIngredient') }
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
    return { ok: false, error: { code: 'validation' } }
  }
  const answer = parsed.data

  const repository = getRepository()
  const draft = await repository.getRecipeDraft(answer.recipeSlug)
  if (!draft) return { ok: false, error: { code: 'not_found' } }

  const next: RecipeDraft = structuredClone(draft)

  if (answer.itemKey && answer.amount) {
    const item = next.items.find((candidate) => candidate.key === answer.itemKey)
    if (!item) return { ok: false, error: { code: 'not_found' } }
    const amount = toDraftAmount(answer.amount)
    if (!amount) return { ok: false, error: { code: 'validation' } }
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
