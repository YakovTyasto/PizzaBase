import 'server-only'
import { z } from 'zod'
import { serverEnv } from '@/lib/config/env'
import { ProviderError, type ProductLookupProvider, type ProductLookupResult } from './types'

/**
 * Open Food Facts product lookup.
 *
 * Needs no API key, but does require a descriptive User-Agent by their usage
 * policy, which `OPENFOODFACTS_USER_AGENT` supplies. The v2 product endpoint is
 * asked for a specific field list so the response stays small.
 */

const offSchema = z.object({
  status: z.number().optional(),
  product: z
    .object({
      product_name: z.string().optional(),
      product_name_en: z.string().optional(),
      brands: z.string().optional(),
      quantity: z.string().optional(),
      product_quantity: z.union([z.string(), z.number()]).optional(),
      product_quantity_unit: z.string().optional(),
      ingredients_text: z.string().optional(),
      allergens_tags: z.array(z.string()).optional(),
      image_front_url: z.string().optional(),
    })
    .optional(),
})

const BARCODE_PATTERN = /^\d{6,14}$/

/** Parses "400 g" or "1.5 l" into a value and a unit. */
export function parseQuantityString(
  raw: string | undefined,
): { value: string; unit: string } | null {
  if (!raw) return null
  const match = /^\s*([\d.,]+)\s*(mg|g|kg|ml|cl|l)\b/i.exec(raw)
  if (!match?.[1] || !match[2]) return null

  const value = match[1].replace(',', '.')
  const unit = match[2].toLowerCase()
  // Centilitres are not a unit the app models; convert to ml at the boundary.
  if (unit === 'cl') return { value: String(Number(value) * 10), unit: 'ml' }
  return { value, unit }
}

export class OpenFoodFactsProvider implements ProductLookupProvider {
  readonly status = {
    name: 'Open Food Facts',
    // No key required, so this provider is always available.
    available: true,
  }

  async lookupByBarcode(barcode: string): Promise<ProductLookupResult | null> {
    // Reject anything that is not a barcode before it reaches a URL, which is
    // also the SSRF guard for this endpoint.
    if (!BARCODE_PATTERN.test(barcode)) {
      throw new ProviderError('Not a valid barcode', 'openfoodfacts')
    }

    const env = serverEnv()
    const fields = [
      'product_name',
      'product_name_en',
      'brands',
      'quantity',
      'product_quantity',
      'product_quantity_unit',
      'ingredients_text',
      'allergens_tags',
      'image_front_url',
    ].join(',')

    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`

    let response: Response
    try {
      response = await fetch(url, {
        headers: { 'user-agent': env.openFoodFactsUserAgent, accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      throw new ProviderError('Could not reach Open Food Facts', 'openfoodfacts', error)
    }

    if (response.status === 404) return null
    if (!response.ok) {
      throw new ProviderError(`Open Food Facts returned ${response.status}`, 'openfoodfacts')
    }

    const parsed = offSchema.safeParse(await response.json())
    if (!parsed.success || !parsed.data.product) return null
    if (parsed.data.status === 0) return null

    const product = parsed.data.product
    const displayName = product.product_name ?? product.product_name_en
    if (!displayName) return null

    const netQuantity =
      parseQuantityString(product.quantity) ??
      (product.product_quantity && product.product_quantity_unit
        ? { value: String(product.product_quantity), unit: product.product_quantity_unit }
        : null)

    return {
      barcode,
      displayName,
      brand: product.brands?.split(',')[0]?.trim() ?? null,
      netQuantity,
      ingredientsText: product.ingredients_text ?? null,
      allergens: (product.allergens_tags ?? []).map((tag) => tag.replace(/^\w+:/, '')),
      imageUrl: product.image_front_url ?? null,
      sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
      // A barcode database hit is a strong match, but the product may still be
      // mislabelled by a contributor, so this is not a certainty.
      confidence: 0.9,
    }
  }
}
