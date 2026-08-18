import type { z } from 'zod'

/**
 * Provider adapters.
 *
 * Every external capability sits behind one of these interfaces so the
 * implementation can be swapped without touching the UI or the domain model.
 *
 * Two rules hold for all of them:
 *
 *  1. A provider is either genuinely available or explicitly `disabled`, and a
 *     disabled provider says which environment variable would enable it. There
 *     is no silent no-op and no fake success.
 *  2. Nothing a provider returns is trusted. Output is parsed with zod, and
 *     anything the source did not state comes back as `unknown` rather than a
 *     plausible-looking value.
 */

export interface ProviderStatus {
  available: boolean
  /** The env var that would turn this on, for the message shown to the user. */
  requiredKey?: string
  name: string
}

export class ProviderDisabledError extends Error {
  constructor(
    readonly provider: string,
    readonly requiredKey: string,
  ) {
    super(`${provider} is not configured. Set ${requiredKey} to enable it.`)
    this.name = 'ProviderDisabledError'
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

// ---------------------------------------------------------------------------
// Product lookup (barcode -> product)
// ---------------------------------------------------------------------------

export interface ProductLookupResult {
  barcode: string
  displayName: string
  brand: string | null
  netQuantity: { value: string; unit: string } | null
  ingredientsText: string | null
  allergens: string[]
  imageUrl: string | null
  sourceUrl: string
  /** 0..1. A barcode database hit is high; a fuzzy name match is not. */
  confidence: number
}

export interface ProductLookupProvider {
  readonly status: ProviderStatus
  lookupByBarcode(barcode: string): Promise<ProductLookupResult | null>
}

// ---------------------------------------------------------------------------
// Vision (photo -> product / text)
// ---------------------------------------------------------------------------

export interface VisionProductResult {
  displayName: string | null
  brand: string | null
  netQuantity: { value: string; unit: string } | null
  ocrText: string | null
  likelyIngredientSlug: string | null
  confidence: number
}

export interface VisionProductProvider {
  readonly status: ProviderStatus
  recognizeProduct(image: { data: Uint8Array; mimeType: string }): Promise<VisionProductResult>
}

// ---------------------------------------------------------------------------
// Transcript (YouTube -> timed text)
// ---------------------------------------------------------------------------

export interface TranscriptSegment {
  text: string
  startSeconds: number
  endSeconds: number
}

export interface TranscriptResult {
  segments: TranscriptSegment[]
  language: string | null
  /** Where this came from, for the audit trail. */
  provider: string
}

export interface TranscriptProvider {
  readonly status: ProviderStatus
  fetchTranscript(videoId: string): Promise<TranscriptResult | null>
}

// ---------------------------------------------------------------------------
// Recipe extraction (text -> structured candidate)
// ---------------------------------------------------------------------------

export interface RecipeExtractionInput {
  /** Transient working text. Never persisted after structuring succeeds. */
  text: string
  title?: string | null
  author?: string | null
  sourceUrl?: string | null
  hasTimecodes?: boolean
}

export interface RecipeExtractionProvider {
  readonly status: ProviderStatus
  extract<T>(input: RecipeExtractionInput, schema: z.ZodType<T>): Promise<T>
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/**
 * Reads a recipe out of a photograph or a screenshot.
 *
 * Separate from `VisionProductProvider`, which reads a package label: the
 * prompts, the schema and the failure modes have nothing in common, and
 * merging them would mean one system prompt trying to be good at both.
 */
export interface RecipeVisionProvider {
  readonly status: ProviderStatus
  extractFromImage<T>(
    image: { data: Uint8Array; mimeType: string },
    schema: z.ZodType<T>,
  ): Promise<T>
}

export interface TranslationRequest {
  text: string
  from: string
  to: string
  /** Hint so the model keeps cooking terminology consistent. */
  context?: 'recipe_name' | 'step' | 'ingredient' | 'note'
}

export interface TranslationProvider {
  readonly status: ProviderStatus
  translate(request: TranslationRequest): Promise<string>
}

// ---------------------------------------------------------------------------
// Recommendation narration (optional garnish over deterministic ranking)
// ---------------------------------------------------------------------------

export interface NarrationRequest {
  recipeName: string
  style: string | null
  coveragePercent: number
  missing: string[]
  locale: string
}

export interface RecommendationNarrationProvider {
  readonly status: ProviderStatus
  narrate(request: NarrationRequest): Promise<string | null>
}
