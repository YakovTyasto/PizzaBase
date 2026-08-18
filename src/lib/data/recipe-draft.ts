import { z } from 'zod'
import { ALL_UNITS, QUALITATIVE_UNITS } from '@/domain'

/**
 * The wire shape of a recipe being created or edited.
 *
 * This schema is the single validation boundary: the editor posts it, the
 * Server Action parses it, and both repositories consume the parsed result.
 * A Server Action is a public endpoint, so nothing here is trusted -- and
 * because the schema is shared, the client cannot submit a shape the server
 * would silently mangle.
 */

export const LOCALE_KEYS = ['ru', 'en', 'fr'] as const

const localizedRequired = z.object({
  ru: z.string().trim().max(200),
  en: z.string().trim().max(200),
  fr: z.string().trim().max(200),
})

const localizedOptional = z.object({
  ru: z.string().trim().max(4000).default(''),
  en: z.string().trim().max(4000).default(''),
  fr: z.string().trim().max(4000).default(''),
})

/**
 * The four amount shapes, mirrored from the domain model.
 *
 * `unknown` is a first-class option in the editor for the same reason it is in
 * the domain: a quantity the owner has not decided on must stay a question,
 * never a zero and never a plausible guess.
 */
export const draftAmountSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('exact'),
    value: z.string().trim().min(1).max(24),
    unit: z.enum(ALL_UNITS as [string, ...string[]]),
  }),
  z.object({
    kind: z.literal('range'),
    min: z.string().trim().min(1).max(24),
    max: z.string().trim().min(1).max(24),
    unit: z.enum(ALL_UNITS as [string, ...string[]]),
  }),
  z.object({
    kind: z.literal('qualitative'),
    unit: z.enum(QUALITATIVE_UNITS as unknown as [string, ...string[]]),
  }),
  z.object({ kind: z.literal('unknown') }),
])

export type DraftAmount = z.infer<typeof draftAmountSchema>

export const draftItemSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    ingredientSlug: z.string().trim().max(200).nullable().default(null),
    componentSlug: z.string().trim().max(200).nullable().default(null),
    amount: draftAmountSchema,
    optional: z.boolean().default(false),
    group: z.string().trim().max(80).nullable().default(null),
    notes: localizedOptional.optional(),
  })
  .refine(
    (item) => Boolean(item.ingredientSlug) !== Boolean(item.componentSlug),
    { message: 'A line must reference exactly one ingredient or one component' },
  )

export const draftStepSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
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
    activeMinutes: z.number().int().min(0).max(10_000).default(0),
    waitMinMinutes: z.number().int().min(0).max(100_000).default(0),
    waitMaxMinutes: z.number().int().min(0).max(100_000).default(0),
    durationKnown: z.boolean().default(true),
    temperatureC: z.number().min(-40).max(600).nullable().default(null),
    timerSeconds: z.number().int().min(1).max(360_000).nullable().default(null),
    itemKeys: z.array(z.string().max(80)).max(50).default([]),
    instructions: localizedOptional,
    cues: localizedOptional.optional(),
    troubleshooting: localizedOptional.optional(),
  })
  .refine((step) => step.waitMaxMinutes >= step.waitMinMinutes, {
    message: 'The waiting window maximum cannot be below its minimum',
  })

export const draftSourceSchema = z.object({
  sourceType: z.enum(['user', 'youtube', 'official', 'website', 'photo', 'text', 'ai_assisted']),
  author: z.string().trim().max(200).nullable().default(null),
  title: z.string().trim().max(300).nullable().default(null),
  url: z.string().trim().max(500).nullable().default(null),
  credibilityTier: z.number().min(0).max(1).default(0.7),
  attribution: z.string().trim().max(500).nullable().default(null),
})

export const draftEvidenceSchema = z.object({
  field: z.string().trim().min(1).max(120),
  itemKey: z.string().trim().max(80).nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
  reviewState: z.enum(['unreviewed', 'needs_review', 'confirmed', 'conflict']),
  conflictGroup: z.string().trim().max(120).nullable().default(null),
  startSeconds: z.number().int().min(0).max(100_000).nullable().default(null),
  notes: localizedOptional,
})

export const recipeDraftSchema = z.object({
  /** Empty when creating; the existing slug when editing. */
  slug: z.string().trim().max(200).nullable().default(null),
  type: z.enum(['pizza', 'dough', 'sauce', 'prep']),
  status: z.enum(['draft', 'needs_review', 'verified']),
  authenticity: z.enum([
    'traditional',
    'pizzaiolo',
    'modern_italian',
    'adapted',
    'experimental',
    'user_verified',
  ]),
  styleSlug: z.string().trim().max(120).nullable().default(null),
  ovenProfileSlug: z.string().trim().max(120).nullable().default(null),
  originLocale: z.enum(LOCALE_KEYS),

  baseYield: z.string().trim().max(24).nullable().default(null),
  yieldUnit: z.enum(ALL_UNITS as [string, ...string[]]).nullable().default(null),
  baseDiameterMm: z.number().int().min(50).max(1200).nullable().default(null),
  baseShape: z.enum(['round', 'rectangular']).nullable().default(null),
  baseTrayWidthMm: z.number().int().min(50).max(3000).nullable().default(null),
  baseTrayHeightMm: z.number().int().min(50).max(3000).nullable().default(null),
  baseBallWeightG: z.string().trim().max(24).nullable().default(null),

  activeMinutes: z.number().int().min(0).max(100_000).nullable().default(null),
  passiveMinutes: z.number().int().min(0).max(1_000_000).nullable().default(null),
  difficulty: z.number().int().min(1).max(5).nullable().default(null),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),

  names: localizedRequired,
  summaries: localizedOptional,
  notes: localizedOptional,

  items: z.array(draftItemSchema).max(120).default([]),
  steps: z.array(draftStepSchema).max(120).default([]),
  source: draftSourceSchema.nullable().default(null),
  evidence: z.array(draftEvidenceSchema).max(120).default([]),

  /**
   * Photos.
   *
   * `storagePath` points into the private bucket when Supabase is holding the
   * file; in demo mode it is null and the bytes live in the browser's own
   * IndexedDB under `id`. Either way the recipe record stays small and carries
   * no image data itself.
   */
  media: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(100),
        storagePath: z.string().trim().max(500).nullable().default(null),
        url: z.string().trim().max(1000).nullable().default(null),
        alt: localizedOptional.default({ ru: '', en: '', fr: '' }),
        isCover: z.boolean().default(false),
      }),
    )
    .max(12)
    .default([]),

  /** Set when the caller knowingly wants a new immutable version snapshot. */
  createVersion: z.boolean().default(false),
  versionNote: z.string().trim().max(500).nullable().default(null),
})

export type RecipeDraft = z.infer<typeof recipeDraftSchema>

export interface DraftValidationIssue {
  path: string
  message: string
}

/**
 * Checks the things a schema cannot: cross-field coherence.
 *
 * Kept separate from zod so the editor can surface these as inline warnings
 * while typing without re-parsing the whole draft on every keystroke.
 */
export function validateDraft(draft: RecipeDraft): DraftValidationIssue[] {
  const issues: DraftValidationIssue[] = []

  // At least one name, in any locale. The rest may fall back.
  if (!draft.names.ru.trim() && !draft.names.en.trim() && !draft.names.fr.trim()) {
    issues.push({ path: 'names', message: 'A recipe needs a name in at least one language' })
  }
  if (!draft.names[draft.originLocale]?.trim()) {
    issues.push({
      path: `names.${draft.originLocale}`,
      message: 'The origin language must have a name, since it is the fallback',
    })
  }

  const keys = new Set<string>()
  for (const [index, item] of draft.items.entries()) {
    if (keys.has(item.key)) {
      issues.push({ path: `items.${index}.key`, message: 'Duplicate ingredient line key' })
    }
    keys.add(item.key)

    if (item.amount.kind === 'exact' && !isFiniteDecimal(item.amount.value)) {
      issues.push({ path: `items.${index}.amount`, message: 'Amount must be a number' })
    }
    if (item.amount.kind === 'range') {
      if (!isFiniteDecimal(item.amount.min) || !isFiniteDecimal(item.amount.max)) {
        issues.push({ path: `items.${index}.amount`, message: 'Range bounds must be numbers' })
      } else if (Number(item.amount.min) > Number(item.amount.max)) {
        issues.push({
          path: `items.${index}.amount`,
          message: 'Range minimum is greater than its maximum',
        })
      }
    }
  }

  const stepKeys = new Set<string>()
  for (const [index, step] of draft.steps.entries()) {
    if (stepKeys.has(step.key)) {
      issues.push({ path: `steps.${index}.key`, message: 'Duplicate step key' })
    }
    stepKeys.add(step.key)

    if (!step.instructions[draft.originLocale]?.trim()) {
      issues.push({
        path: `steps.${index}.instructions`,
        message: 'Each step needs an instruction in the origin language',
      })
    }
    for (const itemKey of step.itemKeys) {
      if (!keys.has(itemKey)) {
        issues.push({
          path: `steps.${index}.itemKeys`,
          message: `Step references "${itemKey}", which is not an ingredient of this recipe`,
        })
      }
    }
  }

  for (const [index, evidence] of draft.evidence.entries()) {
    if (evidence.itemKey && !keys.has(evidence.itemKey)) {
      issues.push({
        path: `evidence.${index}.itemKey`,
        message: `Evidence references "${evidence.itemKey}", which is not an ingredient of this recipe`,
      })
    }
  }

  if (draft.baseYield !== null && !isFiniteDecimal(draft.baseYield)) {
    issues.push({ path: 'baseYield', message: 'Yield must be a number' })
  }
  if (draft.baseYield !== null && draft.yieldUnit === null) {
    issues.push({ path: 'yieldUnit', message: 'A yield needs a unit' })
  }
  if (draft.baseShape === 'round' && draft.baseDiameterMm === null && draft.type === 'pizza') {
    issues.push({ path: 'baseDiameterMm', message: 'A round pizza needs a diameter' })
  }
  if (
    draft.baseShape === 'rectangular' &&
    (draft.baseTrayWidthMm === null || draft.baseTrayHeightMm === null)
  ) {
    issues.push({ path: 'baseTrayWidthMm', message: 'A tray pizza needs both dimensions' })
  }

  // A verified recipe must not still carry an unresolved conflict.
  if (draft.status === 'verified' && draft.evidence.some((e) => e.reviewState === 'conflict')) {
    issues.push({
      path: 'status',
      message: 'A recipe with an unresolved source conflict cannot be marked verified',
    })
  }

  // Photos: one cover at most, and no two rows claiming the same file.
  const seenMedia = new Set<string>()
  for (const [index, photo] of draft.media.entries()) {
    if (seenMedia.has(photo.id)) {
      issues.push({ path: `media.${index}.id`, message: 'Duplicate photo' })
    }
    seenMedia.add(photo.id)
  }
  if (draft.media.filter((photo) => photo.isCover).length > 1) {
    issues.push({ path: 'media', message: 'Only one photo can be the cover' })
  }

  return issues
}

function isFiniteDecimal(value: string): boolean {
  if (!/^-?\d*[.,]?\d+$/.test(value.trim())) return false
  return Number.isFinite(Number(value.replace(',', '.')))
}

/** Turns a name into a URL-safe slug, transliterating Cyrillic. */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  let out = ''
  for (const char of lower) {
    if (CYRILLIC[char] !== undefined) out += CYRILLIC[char]
    else out += char
  }
  return out
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Picks a slug that does not collide with anything already in the catalog. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = slugify(base) || 'recipe'
  if (!taken.has(root)) return root
  for (let n = 2; n < 500; n++) {
    const candidate = `${root}-${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `${root}-${Date.now()}`
}
