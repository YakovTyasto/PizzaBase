'use server'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  type RecipeExtraction,
  type ValidationIssue,
  hasBlockingIssues,
  recipeExtractionSchema,
  validateExtraction,
} from '@/lib/providers/extraction-schema'
import {
  getExtractionProvider,
  getRecipeVisionProvider,
  getTranscriptProvider,
} from '@/lib/providers/registry'
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
import { callerKey } from '@/lib/limits/caller'
import { checkRate } from '@/lib/limits/rate'
import { sniffImageType } from '@/lib/media/signature'
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
/** Vision is billed per image; anything larger is waste, not detail. */
const MAX_VISION_BYTES = 2 * 1024 * 1024

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

  const allowed = await guard('extraction')
  if (allowed) return allowed

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

    // The same video analysed twice in a row is the same candidate; returning
    // the cached one costs nothing instead of paying for the identical answer.
    const cached = readCandidate(text)
    if (cached) {
      return {
        ok: true,
        candidate: {
          extraction: cached,
          issues: validateExtraction(cached),
          sourceUrl: watchUrlFor(videoId),
          videoId,
          provider: transcript.provider,
          hasTimecodes: true,
        },
      }
    }

    const extraction = await getExtractionProvider().extract(
      { text, sourceUrl: watchUrlFor(videoId), hasTimecodes: true },
      recipeExtractionSchema,
    )
    writeCandidate(text, extraction)
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

  const allowed = await guard('extraction')
  if (allowed) return allowed

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


const photoSchema = z.object({
  bytes: z.instanceof(ArrayBuffer),
  contentType: z.string().trim().max(100),
})

/**
 * Reads a recipe out of a photograph.
 *
 * The image was already compressed in the browser, which matters here beyond
 * bandwidth: a Vision call is billed by image size, so sending the 12 MB
 * original instead of the 200 KB version would cost real money for no extra
 * legibility. The bytes are re-checked on this side anyway, because a Server
 * Action is a public endpoint.
 *
 * Nothing is saved. The result is a candidate for the same review screen the
 * other importers use, and it inherits their rule: an amount the photo does
 * not show stays unknown.
 */
export async function importFromPhotoAction(input: unknown): Promise<ImportResult> {
  const parsed = photoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'That image could not be read' }

  const bytes = new Uint8Array(parsed.data.bytes)
  if (bytes.byteLength === 0) return { ok: false, error: 'The image is empty' }
  if (bytes.byteLength > MAX_VISION_BYTES) {
    return { ok: false, error: 'That image is too large to analyse' }
  }

  const sniffed = sniffImageType(bytes.slice(0, 32))
  if (!sniffed) return { ok: false, error: 'That file is not a JPEG, PNG or WebP' }

  const allowed = await guard('vision')
  if (allowed) return allowed

  const provider = getRecipeVisionProvider()

  try {
    const extraction = await provider.extractFromImage(
      { data: bytes, mimeType: sniffed },
      recipeExtractionSchema,
    )
    return {
      ok: true,
      candidate: {
        extraction,
        issues: validateExtraction(extraction),
        sourceUrl: null,
        videoId: null,
        provider: provider.status.name,
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
  /** The source photograph, when the owner chose to keep it. */
  media: z
    .array(z.object({ id: z.string().max(100), storagePath: z.string().max(500).nullable() }))
    .max(4)
    .default([]),
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
  const { extraction, sourceUrl, locale, resolved, createNew, media } = parsed.data

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

  const draft = {
    ...importToDraft({
      extraction: usable,
      resolved: resolvedSlugs,
      sourceUrl,
      locale: locale as Locale,
    }),
    media: media.map((photo, index) => ({
      id: photo.id,
      storagePath: photo.storagePath,
      url: null,
      alt: { ru: '', en: '', fr: '' },
      isCover: index === 0,
    })),
  }

  // The key travels with the save, so even a double submit that races past the
  // check above resolves to one recipe.
  const saved = await saveRecipeAction(draft, key)
  if (!saved.ok) return { ok: false, error: saved.error }

  revalidatePath('/', 'layout')

  return { ok: true, slug: saved.slug, alreadyExisted: false }
}

// ---------------------------------------------------------------------------
// Cost controls
// ---------------------------------------------------------------------------

/**
 * Refuses a paid call the caller has already made too many of.
 *
 * Returns the error to send back, or null to continue -- so a caller reads as
 * `const denied = await guard(...); if (denied) return denied`.
 */
async function guard(kind: 'extraction' | 'vision'): Promise<ImportResult | null> {
  const verdict = checkRate(kind, await callerKey())
  if (verdict.allowed) return null

  return {
    ok: false,
    error: `Too many analyses in a short time. Try again in ${Math.ceil(
      verdict.retryAfterSeconds / 60,
    )} minutes.`,
  }
}

/**
 * A short-lived cache of extractions, keyed by the text they were made from.
 *
 * Pressing Analyse twice on the same transcript is a normal thing to do -- the
 * first result scrolled away, or the review screen was discarded and reopened.
 * Paying twice for a deterministic answer is not.
 */
const candidateCache = new Map<string, { extraction: RecipeExtraction; at: number }>()
const CANDIDATE_TTL_MS = 30 * 60 * 1000
const CANDIDATE_MAX = 50

function cacheKey(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function readCandidate(text: string): RecipeExtraction | null {
  const hit = candidateCache.get(cacheKey(text))
  if (!hit) return null
  if (Date.now() - hit.at > CANDIDATE_TTL_MS) return null
  return hit.extraction
}

function writeCandidate(text: string, extraction: RecipeExtraction): void {
  if (candidateCache.size >= CANDIDATE_MAX) {
    // Oldest first; a Map iterates in insertion order.
    const oldest = candidateCache.keys().next().value
    if (oldest) candidateCache.delete(oldest)
  }
  candidateCache.set(cacheKey(text), { extraction, at: Date.now() })
}
