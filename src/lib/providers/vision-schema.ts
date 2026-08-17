import { z } from 'zod'

/**
 * What the vision provider is allowed to report about a package.
 *
 * Every field is nullable on purpose: a photo where the net weight is hidden by
 * the cook's thumb should come back with `netQuantity: null`, not with a
 * confident guess of 400 g.
 */
export const visionProductSchema = z.object({
  displayName: z.string().nullable().describe('Product name as printed, or null if illegible'),
  brand: z.string().nullable(),
  netQuantity: z
    .object({
      value: z.string().describe('Decimal as a string'),
      unit: z.enum(['mg', 'g', 'kg', 'ml', 'l']),
    })
    .nullable()
    .describe('Only if a net weight or volume is actually printed and legible'),
  ocrText: z.string().nullable().describe('Verbatim text visible on the label'),
  likelyIngredient: z
    .string()
    .nullable()
    .describe('A generic ingredient name such as "mozzarella", or null if unclear'),
  confidence: z.number().min(0).max(1),
})

export type VisionProduct = z.infer<typeof visionProductSchema>
