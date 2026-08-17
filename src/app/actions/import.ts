'use server'

import { z } from 'zod'
import {
  type RecipeExtraction,
  type ValidationIssue,
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
