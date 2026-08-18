import type {
  AuthenticityClass,
  Locale,
  Measure,
  QualitativeUnit,
  RecipeStatus,
  RecipeType,
  Shape,
  StepPhase,
  Unit,
} from '@/domain'

/**
 * Authoring types for the seed catalog.
 *
 * The seed is the single source of truth for both demo mode and the SQL
 * `seed.sql` file, so the data is written once here and projected two ways.
 * Everything is keyed by stable slugs, which is what makes re-seeding an
 * idempotent upsert rather than a duplicate-creating insert.
 */

export type SeedAmount =
  | { kind: 'exact'; value: string; unit: Unit }
  | { kind: 'range'; min: string; max: string; unit: Unit }
  | { kind: 'qualitative'; unit: QualitativeUnit }
  | { kind: 'unknown' }

export const amt = (value: string | number, unit: Unit): SeedAmount => ({
  kind: 'exact',
  value: String(value),
  unit,
})
export const rng = (min: string | number, max: string | number, unit: Unit): SeedAmount => ({
  kind: 'range',
  min: String(min),
  max: String(max),
  unit,
})
export const qual = (unit: QualitativeUnit): SeedAmount => ({ kind: 'qualitative', unit })
export const unk = (): SeedAmount => ({ kind: 'unknown' })

export type Translated<T> = Record<Locale, T>

export interface SeedCategory {
  slug: string
  names: Translated<string>
  /** Order the shopping list departments appear in. */
  sortOrder: number
}

export interface SeedIngredient {
  slug: string
  categorySlug: string
  measure: Measure
  baseUnit: Unit
  /** g per ml. Only set where a real, checkable figure exists. */
  densityGPerMl?: string | null
  names: Translated<string>
  /** Search aliases per locale, on top of the name itself. */
  aliases?: Partial<Translated<string[]>>
  parentSlug?: string | null
  allergens?: string[]
  notes?: Partial<Translated<string>>
}

export interface SeedPackageOption {
  slug: string
  ingredientSlug: string
  packageType: 'can' | 'jar' | 'bottle' | 'pack' | 'bag'
  netAmount: SeedAmount
  brand?: string | null
  barcode?: string | null
  sourceUrl?: string | null
  preferred?: boolean
  labels: Translated<string>
}

export interface SeedSubstitution {
  fromSlug: string
  toSlug: string
  styleSlug?: string | null
  qualityGrade: 'equivalent' | 'good' | 'acceptable' | 'last_resort'
  approved: boolean
  explanations: Translated<string>
}

export interface SeedStyle {
  slug: string
  names: Translated<string>
  descriptions: Translated<string>
}

export interface SeedOvenProfile {
  slug: string
  maxTemperatureC: number
  names: Translated<string>
}

export interface SeedRecipeItem {
  key: string
  ingredientSlug?: string
  componentSlug?: string
  amount: SeedAmount
  optional?: boolean
  group?: string | null
  notes?: Partial<Translated<string>>
}

export interface SeedRecipeStep {
  key: string
  phase: StepPhase
  activeMinutes?: number
  waitMinMinutes?: number
  waitMaxMinutes?: number
  /** False when the source never stated a duration; drives the "approximate" badge. */
  durationKnown?: boolean
  temperatureC?: number | null
  timerSeconds?: number | null
  /** Ingredients used at this step, for cooking mode. */
  itemKeys?: string[]
  instructions: Translated<string>
  cues?: Partial<Translated<string>>
  troubleshooting?: Partial<Translated<string>>
}

export type SourceType = 'user' | 'youtube' | 'official' | 'website' | 'photo' | 'text' | 'ai_assisted'

export interface SeedSource {
  sourceType: SourceType
  author?: string | null
  title?: string | null
  url?: string | null
  /** 0..1; official specs and named professionals rank above anonymous posts. */
  credibilityTier: number
  attribution?: string | null
}

export type ReviewState = 'unreviewed' | 'needs_review' | 'confirmed' | 'conflict'

export interface SeedEvidence {
  /** Which field of which entity this evidence is about, e.g. `recipe.baseYield`. */
  field: string
  itemKey?: string | null
  confidence: number
  reviewState: ReviewState
  conflictGroup?: string | null
  startSeconds?: number | null
  endSeconds?: number | null
  notes: Translated<string>
}

export interface SeedRecipe {
  slug: string
  type: RecipeType
  status: RecipeStatus
  authenticity: AuthenticityClass
  styleSlug?: string | null
  ovenProfileSlug?: string | null
  baseYield?: string | null
  yieldUnit?: Unit | null
  baseDiameterMm?: number | null
  baseShape?: Shape | null
  baseTrayWidthMm?: number | null
  baseTrayHeightMm?: number | null
  baseBallWeightG?: string | null
  activeMinutes?: number | null
  passiveMinutes?: number | null
  difficulty?: 1 | 2 | 3 | 4 | 5
  tags?: string[]
  names: Translated<string>
  summaries: Partial<Translated<string>>
  notes?: Partial<Translated<string>>
  /** Locale the recipe was authored in; drives translation fallback badges. */
  originLocale: Locale
  items: SeedRecipeItem[]
  steps: SeedRecipeStep[]
  source?: SeedSource
  evidence?: SeedEvidence[]
  media?: SeedRecipeMedia[]
}

/**
 * A photo attached to a recipe.
 *
 * The bundled catalog ships none -- these appear only on recipes the owner
 * authored -- but they live in the same shape so an authored recipe and a
 * seeded one stay interchangeable everywhere downstream.
 */
export interface SeedRecipeMedia {
  id: string
  storagePath?: string | null
  url?: string | null
  alt?: Partial<Translated<string>>
  isCover?: boolean
}

export interface SeedCatalog {
  categories: SeedCategory[]
  ingredients: SeedIngredient[]
  packageOptions: SeedPackageOption[]
  substitutions: SeedSubstitution[]
  styles: SeedStyle[]
  ovenProfiles: SeedOvenProfile[]
  recipes: SeedRecipe[]
}
