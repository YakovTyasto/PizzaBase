import { z } from 'zod'
import { ALL_UNITS } from '@/domain'

/**
 * The contract for anything that extracts a recipe from unstructured input.
 *
 * The critical design choice is that `unknown` is a first-class amount kind.
 * A model asked for a number will invent one; a model given an explicit way to
 * say "the source never stated this" will use it. Every downstream guarantee
 * about not fabricating quantities rests on this shape.
 */

export const extractedAmountSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('exact'),
    value: z.string().describe('Decimal as a string, e.g. "310" or "0.16"'),
    unit: z.enum(ALL_UNITS as [string, ...string[]]),
  }),
  z.object({
    kind: z.literal('range'),
    min: z.string(),
    max: z.string(),
    unit: z.enum(ALL_UNITS as [string, ...string[]]),
  }),
  z.object({
    kind: z.literal('qualitative'),
    unit: z.enum(['pinch', 'handful', 'to_taste', 'as_needed']),
  }),
  z.object({
    kind: z.literal('unknown'),
    reason: z.string().describe('Why the amount is unknown, e.g. "not stated in the video"'),
  }),
])

export const extractedIngredientSchema = z.object({
  name: z.string().describe('The ingredient exactly as the source names it'),
  amount: extractedAmountSchema,
  optional: z.boolean(),
  group: z
    .string()
    .nullable()
    .describe('Stage such as "poolish", "biga", "final", "topping", or null'),
  note: z.string().nullable(),
  startSeconds: z.number().nullable().describe('Timecode where this ingredient is stated, or null'),
})

export const extractedStepSchema = z.object({
  instruction: z.string(),
  phase: z.enum([
    'preferment',
    'mix',
    'bulk',
    'fold',
    'ball',
    'cold_proof',
    'warm_up',
    'shape',
    'bake',
    'serve',
    'prep',
    'other',
  ]),
  activeMinutes: z.number().nullable(),
  waitMinMinutes: z.number().nullable(),
  waitMaxMinutes: z.number().nullable(),
  temperatureC: z.number().nullable(),
  sensoryCues: z.string().nullable(),
  startSeconds: z.number().nullable(),
})

export const extractedConflictSchema = z.object({
  field: z.string().describe('Which field is disputed, e.g. "salt amount"'),
  description: z.string(),
})

export const recipeExtractionSchema = z.object({
  title: z.string().nullable(),
  summary: z.string().nullable(),
  detectedLanguage: z.string().nullable(),
  type: z.enum(['pizza', 'dough', 'sauce', 'prep']),
  style: z.string().nullable(),
  yieldCount: z
    .string()
    .nullable()
    .describe('How many pizzas or how much this makes, as stated. Null if not stated'),
  yieldUnit: z.enum(ALL_UNITS as [string, ...string[]]).nullable(),
  ballWeightG: z.string().nullable(),
  ingredients: z.array(extractedIngredientSchema),
  steps: z.array(extractedStepSchema),
  equipment: z.array(z.string()),
  /** Anything the source contradicts itself about, surfaced for review. */
  conflicts: z.array(extractedConflictSchema),
  /** 0..1 self-assessment; treated as a hint, never as a fact. */
  overallConfidence: z.number().min(0).max(1),
})

export type RecipeExtraction = z.infer<typeof recipeExtractionSchema>
export type ExtractedAmount = z.infer<typeof extractedAmountSchema>
export type ExtractedIngredient = z.infer<typeof extractedIngredientSchema>

export const EXTRACTION_SYSTEM_PROMPT = `You extract pizza recipes from source material into structured data.

Absolute rules:
- Never invent a quantity, temperature or duration. If the source does not state it, use {"kind":"unknown","reason":"..."}.
- If the source gives a range ("25 to 30 grams"), use kind "range". Do not average it.
- If the source says "to taste", "a pinch", "as needed", use kind "qualitative".
- Use the exact numbers stated. Do not convert units, round, or tidy them up.
- If the source contradicts itself, record every disputed field in "conflicts" and use the value stated most clearly; if no value is clear, use "unknown".
- Do not add ingredients that the source does not mention, even if they are typical for the style.
- Do not classify anything as traditional or authentic. That judgement is not yours to make.

Return only data that is actually present in the input.`

/**
 * Validates an extraction for internal contradictions before a human ever sees
 * it. These checks are arithmetic, not opinion, and catch the cases where a
 * model produced well-formed but incoherent output.
 */
export interface ValidationIssue {
  severity: 'error' | 'warning'
  field: string
  message: string
}

export function validateExtraction(extraction: RecipeExtraction): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const seen = new Map<string, number>()
  for (const ingredient of extraction.ingredients) {
    const key = ingredient.name.trim().toLowerCase()
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  for (const [name, count] of seen) {
    if (count > 1) {
      issues.push({
        severity: 'warning',
        field: `ingredient:${name}`,
        message: `"${name}" appears ${count} times; check whether these are separate stages or a duplicate.`,
      })
    }
  }

  for (const ingredient of extraction.ingredients) {
    if (ingredient.amount.kind === 'range') {
      const min = Number(ingredient.amount.min)
      const max = Number(ingredient.amount.max)
      if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
        issues.push({
          severity: 'error',
          field: `ingredient:${ingredient.name}`,
          message: 'Range minimum is greater than its maximum.',
        })
      }
    }
    if (ingredient.amount.kind === 'exact' && !Number.isFinite(Number(ingredient.amount.value))) {
      issues.push({
        severity: 'error',
        field: `ingredient:${ingredient.name}`,
        message: 'Amount is not a number.',
      })
    }
  }

  for (const [index, step] of extraction.steps.entries()) {
    const min = step.waitMinMinutes
    const max = step.waitMaxMinutes
    if (min !== null && max !== null && min > max) {
      issues.push({
        severity: 'error',
        field: `step:${index}`,
        message: 'Wait window minimum is greater than its maximum.',
      })
    }
    if (step.temperatureC !== null && (step.temperatureC < -30 || step.temperatureC > 600)) {
      issues.push({
        severity: 'warning',
        field: `step:${index}`,
        message: `Temperature of ${step.temperatureC}°C looks implausible.`,
      })
    }
  }

  for (const conflict of extraction.conflicts) {
    issues.push({
      severity: 'warning',
      field: conflict.field,
      message: conflict.description,
    })
  }

  if (extraction.ingredients.length === 0) {
    issues.push({
      severity: 'error',
      field: 'ingredients',
      message: 'No ingredients were found in the source.',
    })
  }

  return issues
}

/** True when the candidate is safe to save without further human input. */
export function hasBlockingIssues(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}
