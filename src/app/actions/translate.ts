'use server'

import { z } from 'zod'
import type { Locale } from '@/domain'
import { callerKey } from '@/lib/limits/caller'
import { checkRate } from '@/lib/limits/rate'
import { getTranslationProvider } from '@/lib/providers/registry'
import { ProviderDisabledError } from '@/lib/providers/types'
import { compareInvariants, describeDiff } from '@/lib/translate/invariants'

/**
 * Proposes translations for chosen fields.
 *
 * Three rules, all enforced here rather than trusted to the prompt:
 *
 *  1. Nothing is applied. The action returns proposals; the owner reviews a
 *     side-by-side diff and decides.
 *  2. Every figure must survive. A proposal whose numbers, temperatures,
 *     percentages, timecodes or links do not match the source is returned as
 *     `refused`, with what changed, and cannot be applied.
 *  3. Ingredient names are not in scope at all. A recipe references
 *     ingredients by id and renders them from the catalog's own translations,
 *     so there is nothing here to re-translate and no way to end up with two
 *     names for one ingredient.
 */

const FIELD_LIMIT = 60

const requestSchema = z.object({
  from: z.enum(['ru', 'en', 'fr']),
  to: z.enum(['ru', 'en', 'fr']),
  fields: z
    .array(
      z.object({
        path: z.string().min(1).max(200),
        text: z.string().max(4000),
        context: z.enum(['recipe_name', 'step', 'ingredient', 'note']).optional(),
      }),
    )
    .min(1)
    .max(FIELD_LIMIT),
})

export type FieldProposal =
  | { path: string; status: 'ok'; text: string }
  | { path: string; status: 'refused'; text: string; reason: string }
  | { path: string; status: 'failed'; reason: string }

export type TranslateResult =
  | { ok: true; proposals: FieldProposal[]; provider: string }
  | { ok: false; error: string; requiredKey?: string }

export async function translateFieldsAction(input: unknown): Promise<TranslateResult> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Nothing to translate' }

  const { from, to, fields } = parsed.data
  if (from === to) return { ok: false, error: 'Source and target are the same language' }

  const verdict = checkRate('translation', await callerKey())
  if (!verdict.allowed) {
    return {
      ok: false,
      error: `Too many translations in a short time. Try again in ${Math.ceil(
        verdict.retryAfterSeconds / 60,
      )} minutes.`,
    }
  }

  const provider = getTranslationProvider()
  if (!provider.status.available) {
    return {
      ok: false,
      error: `${provider.status.name} is not configured`,
      requiredKey: provider.status.requiredKey,
    }
  }

  const proposals: FieldProposal[] = []

  for (const field of fields) {
    const source = field.text.trim()
    if (!source) continue

    try {
      const text = (
        await provider.translate({
          text: source,
          from: from as Locale,
          to: to as Locale,
          context: field.context,
        })
      ).trim()

      const diff = compareInvariants(source, text)
      proposals.push(
        diff.ok
          ? { path: field.path, status: 'ok', text }
          : { path: field.path, status: 'refused', text, reason: describeDiff(diff) },
      )
    } catch (error) {
      if (error instanceof ProviderDisabledError) {
        return { ok: false, error: error.message, requiredKey: error.requiredKey }
      }
      proposals.push({
        path: field.path,
        status: 'failed',
        reason: error instanceof Error ? error.message : 'The translation failed',
      })
    }
  }

  return { ok: true, proposals, provider: provider.status.name }
}
