'use server'

import { z } from 'zod'
import { getProductLookupProvider, getVisionProvider } from '@/lib/providers/registry'
import { ProviderDisabledError, ProviderError } from '@/lib/providers/types'

/**
 * Product scanning.
 *
 * Order of attempts: barcode database first, vision only as a fallback. The
 * cheap, authoritative source is tried before the expensive, uncertain one, and
 * the result always records which of the two produced it so the review screen
 * can say where the data came from.
 *
 * Nothing is written to the pantry here. The result is a proposal the user
 * confirms.
 */

export interface ScanResult {
  displayName: string | null
  brand: string | null
  netQuantity: { value: string; unit: string } | null
  ingredientsText: string | null
  allergens: string[]
  barcode: string | null
  sourceUrl: string | null
  source: 'barcode' | 'ocr' | 'vision'
  confidence: number
}

export type ScanResponse =
  | { ok: true; result: ScanResult }
  | { ok: false; error: string; requiredKey?: string; notFound?: boolean }

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
])

export async function lookupBarcodeAction(rawBarcode: unknown): Promise<ScanResponse> {
  const parsed = z
    .string()
    .regex(/^\d{6,14}$/, 'That does not look like a barcode')
    .safeParse(rawBarcode)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message }

  try {
    const product = await getProductLookupProvider().lookupByBarcode(parsed.data)
    if (!product) return { ok: false, error: 'Not found in the product database.', notFound: true }

    return {
      ok: true,
      result: {
        displayName: product.displayName,
        brand: product.brand,
        netQuantity: product.netQuantity,
        ingredientsText: product.ingredientsText,
        allergens: product.allergens,
        barcode: product.barcode,
        sourceUrl: product.sourceUrl,
        source: 'barcode',
        confidence: product.confidence,
      },
    }
  } catch (error) {
    if (error instanceof ProviderError) return { ok: false, error: error.message }
    return { ok: false, error: 'The lookup failed.' }
  }
}

export async function recognizeImageAction(formData: FormData): Promise<ScanResponse> {
  const file = formData.get('image')
  if (!(file instanceof File)) return { ok: false, error: 'No image was provided.' }

  // Size and MIME are checked before a single byte reaches a paid API.
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'That image is too large (limit 8 MB).' }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: 'That file type is not supported.' }
  }

  const vision = getVisionProvider()
  if (!vision.status.available) {
    return {
      ok: false,
      error: `${vision.status.name} is not configured.`,
      requiredKey: vision.status.requiredKey,
    }
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    const result = await vision.recognizeProduct({ data, mimeType: file.type })

    return {
      ok: true,
      result: {
        displayName: result.displayName,
        brand: result.brand,
        netQuantity: result.netQuantity,
        ingredientsText: null,
        allergens: [],
        barcode: null,
        sourceUrl: null,
        // The label text came from the image, so this is OCR-derived.
        source: result.ocrText ? 'ocr' : 'vision',
        confidence: result.confidence,
      },
    }
  } catch (error) {
    if (error instanceof ProviderDisabledError) {
      return { ok: false, error: error.message, requiredKey: error.requiredKey }
    }
    if (error instanceof ProviderError) return { ok: false, error: error.message }
    return { ok: false, error: 'The image could not be read.' }
  }
}
