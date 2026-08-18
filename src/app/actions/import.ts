'use server'

import { z } from 'zod'
import {
  type RecipeExtraction,
  type ValidationIssue,
  hasBlockingIssues,
  recipeExtractionSchema,
  validateExtraction,
} from '@/lib/providers/extraction-schema'
import { getExtractionProvider, getTranscriptProvider } from '@/lib/providers/registry'
import {
  InvalidYouTubeUrlError,
  parseYouTubeUrl,
  transcriptFromText,
  transcriptToPlainText,
  watchUrlFor,
} from '@/lib/providers/transcript'
import { ProviderDisabledError, ProviderError } from '@/lib/providers/types'
import { revalidatePath } from 'next/cache'
import type { Locale } from '@/domain'
import { getRepository } from '@/lib/data'
import {
  buildCatalog,
  idempotencyKeyFor,
  importToDraft,
  matchIngredient,
} from '@/lib/import/to-draft'
import { saveRecipeAction } from './recipes'

/**
 * Import pipeline.
 *
 * The transcript is fetched, structured and then discarded: only the derived
 * recipe, its attribution and its timecodes are ever returned. No copy of a
 * third-party transcript is retained after structuring succeeds.
 *
 * Nothing produced here is saved. The result is a *candidate* which the user
 * reviews and approves; that is what keeps an AI extraction from silently
 * becoming a recipe.
 */

export interface ImportCandidate {
  extraction: RecipeExtraction
  issues: ValidationIssue[]
  sourceUrl: string | null
  videoId: string | null
  provider: string
  hasTimecodes: boolean
}

export type ImportResult =
  | { ok: true; candidate: ImportCandidate }
  | { ok: false; error: string; needsManualTranscript?: boolean; requiredKey?: string }

const MAX_TEXT_LENGTH = 100_000

function describeError(error: unknown): ImportResult {
  if (error instanceof ProviderDisabledError) {
    return { ok: false, error: error.message, requiredKey: error.requiredKey }
  }
  if (error instanceof ProviderError) return { ok: false, error: error.message }
  if (error instanceof InvalidYouTubeUrlError) return { ok: false, error: error.message }
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'The import could not be completed',
  }
}

export async function importFromYouTubeAction(rawUrl: unknown): Promise<ImportResult> {
  const parsed = z.string().min(1).max(500).safeParse(rawUrl)
  if (!parsed.success) return { ok: false, error: 'A video link is required' }

  let videoId: string
  try {
    // Rejects any host but YouTube, so a user-supplied URL can never become an
    // arbitrary outbound request.
    videoId = parseYouTubeUrl(parsed.data)
  } catch (error) {
    return describeError(error)
  }

  const transcriptProvider = getTranscriptProvider()

  let transcript
  try {
    transcript = await transcriptProvider.fetchTranscript(videoId)
  } catch (error) {
    return describeError(error)
  }

  if (!transcript) {
    return {
      ok: false,
      error: 'No transcript is available for this video.',
      needsManualTranscript: true,
      requiredKey: transcriptProvider.status.requiredKey,
    }
  }

  try {
    const text = transcriptToPlainText(transcript)
    const extraction = await getExtractionProvider().extract(
      { text, sourceUrl: watchUrlFor(videoId), hasTimecodes: true },
      recipeExtractionSchema,
    )
    // `transcript` and `text` go out of scope here and are never persisted.
    return {
      ok: true,
      candidate: {
        extraction,
        issues: validateExtraction(extraction),
        sourceUrl: watchUrlFor(videoId),
        videoId,
        provider: transcript.provider,
        hasTimecodes: true,
      },
    }
  } catch (error) {
    return describeError(error)
  }
}

const manualSchema = z.object({
  text: z.string().min(20).max(MAX_TEXT_LENGTH),
  sourceUrl: z.string().max(500).nullable().optional(),
  title: z.string().max(300).nullable().optional(),
})

export async function importFromTextAction(input: unknown): Promise<ImportResult> {
  const parsed = manualSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Paste at least a few lines of recipe text.' }
  }

  // A pasted transcript may name a YouTube source; validate it rather than
  // storing whatever the user typed.
  let sourceUrl: string | null = null
  if (parsed.data.sourceUrl) {
    try {
      sourceUrl = watchUrlFor(parseYouTubeUrl(parsed.data.sourceUrl))
    } catch {
      sourceUrl = null
    }
  }

  try {
    const transcript = transcriptFromText(parsed.data.text)
    const extraction = await getExtractionProvider().extract(
      {
        text: transcriptToPlainText(transcript),
        title: parsed.data.title ?? null,
        sourceUrl,
        hasTimecodes: false,
      },
      recipeExtractionSchema,
    )
    return {
      ok: true,
      candidate: {
        extraction,
        issues: validateExtraction(extraction),
        sourceUrl,
        videoId: null,
        provider: 'manual',
        hasTimecodes: false,
      },
    }
  } catch (error) {
    return describeError(error)
  }
}


// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

export interface IngredientMatchView {
  extractedName: string
  slug: string | null
  suggestedName: string | null
  confidence: number
}

/**
 * Proposes a catalog match for every extracted ingredient.
 *
 * Matching is normalized across all three locales and every alias, so the same
 * ingredient arriving in a different language resolves to the entry that
 * already exists rather than creating a duplicate.
 */
export async function matchImportIngredientsAction(
  names: unknown,
): Promise<IngredientMatchView[]> {
  const parsed = z.array(z.string().max(200)).max(200).safeParse(names)
  if (!parsed.success) return []

  const ingredients = await getRepository().listIngredients('en')
  const catalog = buildCatalog(
    ingredients.map((ingredient) => ({
      slug: ingredient.slug,
      name: ingredient.name.value,
      aliases: ingredient.aliases,
    })),
  )
  const bySlug = new Map(ingredients.map((ingredient) => [ingredient.slug, ingredient]))

  return parsed.data.map((name) => {
    const match = matchIngredient(name, catalog)
    return {
      extractedName: name,
      slug: match.slug,
      suggestedName: match.slug ? (bySlug.get(match.slug)?.name.value ?? null) : null,
      confidence: match.confidence,
    }
  })
}

const approveSchema = z.object({
  extraction: recipeExtractionSchema,
  sourceUrl: z.string().max(500).nullable().default(null),
  locale: z.enum(['ru', 'en', 'fr']),
  /** Extracted name -> catalog slug, as confirmed on the review screen. */
  resolved: z.record(z.string(), z.string()).default({}),
  /** Extracted names the owner asked to create as new canonical ingredients. */
  createNew: z.array(z.string().max(200)).max(100).default([]),
})

export type ApproveResult =
  | { ok: true; slug: string; alreadyExisted: boolean }
  | { ok: false; error: string }

/**
 * Saves an approved candidate.
 *
 * Guarded by a content-derived idempotency key: a double click, a retry or a
 * refreshed submit all resolve to the same key, and the second attempt returns
 * the recipe that already exists instead of creating a duplicate.
 */
export async function approveImportAction(input: unknown): Promise<ApproveResult> {
  const parsed = approveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'The import is not valid' }
  }
  const { extraction, sourceUrl, locale, resolved, createNew } = parsed.data

  // Refuse to save something the validator considers broken.
  const issues = validateExtraction(extraction)
  if (hasBlockingIssues(issues)) {
    return {
      ok: false,
      error: issues.find((issue) => issue.severity === 'error')?.message ?? 'The import is not valid',
    }
  }

  const repository = getRepository()
  const key = idempotencyKeyFor(extraction, sourceUrl)

  const already = await repository.findAppliedMutation(key)
  if (already) {
    // Already saved. Point at the exact recipe it produced rather than making
    // another, or guessing which one it was from the title.
    return { ok: true, slug: already, alreadyExisted: true }
  }

  const resolvedSlugs: Record<string, string> = { ...resolved }

  // Create the ingredients the owner explicitly asked for, and only those.
  for (const name of createNew) {
    if (resolvedSlugs[name]) continue
    try {
      const slug = await repository.createIngredient({
        names: { ru: name, en: name, fr: name },
        categorySlug: 'pantry',
        measure: 'mass',
        baseUnit: 'g',
        aliases: [name],
      })
      resolvedSlugs[name] = slug
    } catch {
      // A failed ingredient creation must not half-save the recipe.
      return { ok: false, error: `Could not create the ingredient "${name}"` }
    }
  }

  // Anything still unresolved would produce an item with no target, which the
  // schema rejects; drop those lines and record them as an open question.
  const usable = {
    ...extraction,
    ingredients: extraction.ingredients.filter((ingredient) => resolvedSlugs[ingredient.name]),
  }
  if (usable.ingredients.length === 0) {
    return { ok: false, error: 'Match at least one ingredient to the catalog first' }
  }

  const draft = importToDraft({
    extraction: usable,
    resolved: resolvedSlugs,
    sourceUrl,
    locale: locale as Locale,
  })

  // The key travels with the save, so even a double submit that races past the
  // check above resolves to one recipe.
  const saved = await saveRecipeAction(draft, key)
  if (!saved.ok) return { ok: false, error: saved.error }

  revalidatePath('/', 'layout')

  return { ok: true, slug: saved.slug, alreadyExisted: false }
}
