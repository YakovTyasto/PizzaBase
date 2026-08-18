import 'server-only'
import type { z } from 'zod'
import { serverEnv } from '@/lib/config/env'
import { EXTRACTION_SYSTEM_PROMPT } from './extraction-schema'
import { imagePart, openaiStatus, structuredCompletion, textCompletion } from './openai'
import { OpenFoodFactsProvider } from './product-lookup'
import { ManualTranscriptProvider, SupadataTranscriptProvider } from './transcript'
import {
  type NarrationRequest,
  type ProductLookupProvider,
  ProviderDisabledError,
  type RecipeExtractionInput,
  type RecipeExtractionProvider,
  type RecommendationNarrationProvider,
  type TranscriptProvider,
  type TranslationProvider,
  type TranslationRequest,
  type RecipeVisionProvider,
  type VisionProductProvider,
  type VisionProductResult,
} from './types'
import { visionProductSchema } from './vision-schema'
import { mockExtraction, mockPhotoExtraction } from './mock'

/**
 * Provider selection.
 *
 * Each getter returns a real implementation when its key is present and an
 * honest disabled one otherwise. Nothing pretends: a disabled provider throws
 * `ProviderDisabledError` naming the variable that would enable it, and the UI
 * turns that into "set OPENAI_API_KEY to enable this" rather than a dead button.
 */

export function getProductLookupProvider(): ProductLookupProvider {
  return new OpenFoodFactsProvider()
}

export function getTranscriptProvider(): TranscriptProvider {
  return serverEnv().supadataApiKey
    ? new SupadataTranscriptProvider()
    : new ManualTranscriptProvider()
}

class OpenAIVisionProvider implements VisionProductProvider {
  get status() {
    return openaiStatus('OpenAI vision')
  }

  async recognizeProduct(image: {
    data: Uint8Array
    mimeType: string
  }): Promise<VisionProductResult> {
    const result = await structuredCompletion({
      system:
        'You read food product packaging. Report only what is legible on the package. ' +
        'If a field is not visible, return null for it. Never guess a brand or a net weight.',
      content: [
        {
          type: 'input_text',
          text: 'Identify this food product from its packaging and transcribe the label text.',
        },
        imagePart(image.data, image.mimeType),
      ],
      schema: visionProductSchema,
      schemaName: 'product_recognition',
      maxOutputTokens: 1500,
    })

    return {
      displayName: result.displayName,
      brand: result.brand,
      netQuantity: result.netQuantity,
      ocrText: result.ocrText,
      likelyIngredientSlug: result.likelyIngredient,
      confidence: result.confidence,
    }
  }
}

class DisabledVisionProvider implements VisionProductProvider {
  readonly status = { name: 'Vision', available: false, requiredKey: 'OPENAI_API_KEY' }

  async recognizeProduct(): Promise<VisionProductResult> {
    throw new ProviderDisabledError('Vision', 'OPENAI_API_KEY')
  }
}

export function getVisionProvider(): VisionProductProvider {
  return serverEnv().openaiApiKey ? new OpenAIVisionProvider() : new DisabledVisionProvider()
}

class OpenAIExtractionProvider implements RecipeExtractionProvider {
  get status() {
    return openaiStatus('OpenAI extraction')
  }

  async extract<T>(input: RecipeExtractionInput, schema: z.ZodType<T>): Promise<T> {
    const header = [
      input.title ? `Title: ${input.title}` : null,
      input.author ? `Author: ${input.author}` : null,
      input.hasTimecodes
        ? 'The text is timecoded as [m:ss]. Record the timecode where each ingredient and step is stated.'
        : 'The text has no timecodes; return null for every startSeconds field.',
    ]
      .filter(Boolean)
      .join('\n')

    return structuredCompletion({
      system: EXTRACTION_SYSTEM_PROMPT,
      content: [{ type: 'input_text', text: `${header}\n\n---\n\n${input.text}` }],
      schema,
      schemaName: 'recipe_extraction',
      maxOutputTokens: 6000,
    })
  }
}

/**
 * Used when no key is configured and in tests. Returns a fixture rather than
 * throwing so the whole import flow -- review screen, conflict display,
 * approval -- can be exercised without an API key.
 */
class MockExtractionProvider implements RecipeExtractionProvider {
  readonly status = {
    name: 'Mock extraction',
    available: true,
    requiredKey: 'OPENAI_API_KEY',
  }

  async extract<T>(input: RecipeExtractionInput, schema: z.ZodType<T>): Promise<T> {
    return schema.parse(mockExtraction(input))
  }
}

class OpenAIRecipeVisionProvider implements RecipeVisionProvider {
  get status() {
    return openaiStatus('OpenAI recipe vision')
  }

  async extractFromImage<T>(
    image: { data: Uint8Array; mimeType: string },
    schema: z.ZodType<T>,
  ): Promise<T> {
    return structuredCompletion({
      // The same rule as the text extractor, stated for the harder case: a
      // photograph invites guessing in a way a transcript does not, because a
      // quantity can be blurred, cropped or hidden behind a hand.
      system:
        `${EXTRACTION_SYSTEM_PROMPT}

` +
        'You are reading a photograph or screenshot of a recipe. Transcribe only ' +
        'what is legible. If a quantity is cut off, blurred, or absent, return an ' +
        'unknown amount with the reason -- never estimate it from the others, and ' +
        'never infer a typical value for the dish. The image has no timecodes, so ' +
        'every startSeconds field is null.',
      content: [
        {
          type: 'input_text',
          text: 'Extract the recipe shown in this image.',
        },
        imagePart(image.data, image.mimeType),
      ],
      schema,
      schemaName: 'recipe_from_image',
      maxOutputTokens: 6000,
    })
  }
}

/**
 * Fixture used when no key is configured.
 *
 * Deliberately *not* the transcript fixture: a photo of a handwritten card
 * loses different things than a video does, so this one is missing a quantity
 * the camera cropped and has a lower confidence to match.
 */
class MockRecipeVisionProvider implements RecipeVisionProvider {
  readonly status = {
    name: 'Mock recipe vision',
    available: true,
    requiredKey: 'OPENAI_API_KEY',
  }

  async extractFromImage<T>(
    _image: { data: Uint8Array; mimeType: string },
    schema: z.ZodType<T>,
  ): Promise<T> {
    return schema.parse(mockPhotoExtraction())
  }
}

export function getRecipeVisionProvider(): RecipeVisionProvider {
  return serverEnv().openaiApiKey
    ? new OpenAIRecipeVisionProvider()
    : new MockRecipeVisionProvider()
}

export function getExtractionProvider(): RecipeExtractionProvider {
  return serverEnv().openaiApiKey ? new OpenAIExtractionProvider() : new MockExtractionProvider()
}

class OpenAITranslationProvider implements TranslationProvider {
  get status() {
    return openaiStatus('OpenAI translation')
  }

  async translate(request: TranslationRequest): Promise<string> {
    return textCompletion({
      system:
        'You translate cooking text. Preserve every number, unit, temperature, timecode and URL exactly as written. ' +
        'Do not convert units, do not round, do not add or remove information. Reply with the translation only.',
      content: [
        {
          type: 'input_text',
          text: `Translate from ${request.from} to ${request.to}${
            request.context ? ` (context: ${request.context})` : ''
          }:\n\n${request.text}`,
        },
      ],
      maxOutputTokens: 2000,
    })
  }
}

class DisabledTranslationProvider implements TranslationProvider {
  readonly status = { name: 'Translation', available: false, requiredKey: 'OPENAI_API_KEY' }

  async translate(): Promise<string> {
    throw new ProviderDisabledError('Translation', 'OPENAI_API_KEY')
  }
}

export function getTranslationProvider(): TranslationProvider {
  return serverEnv().openaiApiKey
    ? new OpenAITranslationProvider()
    : new DisabledTranslationProvider()
}

/**
 * Narration is pure garnish over an already-computed ranking. When it is off
 * the recommendation screen loses one sentence and nothing else, which is why
 * this returns null instead of throwing.
 */
class OpenAINarrationProvider implements RecommendationNarrationProvider {
  get status() {
    return openaiStatus('OpenAI narration')
  }

  async narrate(request: NarrationRequest): Promise<string | null> {
    try {
      return await textCompletion({
        system:
          'You write one short sentence explaining why a pizza recipe suits the cook right now. ' +
          'Never state quantities, never claim a recipe is traditional or authentic, and never suggest substitutions. ' +
          'Reply in the requested language with one sentence and nothing else.',
        content: [
          {
            type: 'input_text',
            text: `Language: ${request.locale}. Recipe: ${request.recipeName}. Style: ${
              request.style ?? 'unspecified'
            }. Pantry coverage: ${request.coveragePercent}%. Missing: ${
              request.missing.join(', ') || 'nothing'
            }.`,
          },
        ],
        maxOutputTokens: 200,
      })
    } catch {
      return null
    }
  }
}

class DisabledNarrationProvider implements RecommendationNarrationProvider {
  readonly status = { name: 'Narration', available: false, requiredKey: 'OPENAI_API_KEY' }

  async narrate(): Promise<string | null> {
    return null
  }
}

export function getNarrationProvider(): RecommendationNarrationProvider {
  return serverEnv().openaiApiKey ? new OpenAINarrationProvider() : new DisabledNarrationProvider()
}

/** The Settings screen reads this to show exactly what is and is not wired up. */
export function providerStatuses() {
  return {
    productLookup: getProductLookupProvider().status,
    transcript: getTranscriptProvider().status,
    vision: getVisionProvider().status,
    extraction: getExtractionProvider().status,
    translation: getTranslationProvider().status,
    narration: getNarrationProvider().status,
  }
}
