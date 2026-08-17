import type {
  Amount,
  AuthenticityClass,
  Locale,
  PackageOption,
  RecipeGraph,
  RecipeStatus,
  RecipeType,
  Shape,
  StepPhase,
  StorageLocation,
  Substitution,
  Unit,
} from '@/domain'
import type { ReviewState, SourceType } from '@/lib/seed/types'

/**
 * View models handed to the UI.
 *
 * Translation resolution has already happened by the time a component sees
 * one of these: `name` is the best available string and `fallbackFrom` records
 * which locale it actually came from, so the UI can badge it honestly instead
 * of pretending a French translation exists.
 */
export interface LocalizedText {
  value: string
  /** Set when `value` is not in the requested locale. */
  fallbackFrom: Locale | null
}

export interface IngredientView {
  id: string
  slug: string
  name: LocalizedText
  categoryId: string
  categoryName: LocalizedText
  measure: string
  baseUnit: Unit
  densityGPerMl: string | null
  aliases: string[]
  allergens: string[]
  parentId: string | null
}

export interface RecipeItemView {
  id: string
  key: string
  ingredientId: string | null
  componentRecipeId: string | null
  /** Resolved display name of the ingredient or component. */
  name: LocalizedText
  amount: Amount
  optional: boolean
  group: string | null
  note: LocalizedText | null
  sortOrder: number
}

export interface RecipeStepView {
  id: string
  key: string
  phase: StepPhase
  sortOrder: number
  activeMinutes: number
  waitMinMinutes: number
  waitMaxMinutes: number
  durationKnown: boolean
  temperatureC: number | null
  timerSeconds: number | null
  itemIds: string[]
  instruction: LocalizedText
  cues: LocalizedText | null
  troubleshooting: LocalizedText | null
}

export interface SourceView {
  sourceType: SourceType
  author: string | null
  title: string | null
  url: string | null
  credibilityTier: number
  attribution: string | null
}

export interface EvidenceView {
  id: string
  field: string
  itemId: string | null
  confidence: number
  reviewState: ReviewState
  conflictGroup: string | null
  startSeconds: number | null
  note: LocalizedText
}

export interface RecipeSummary {
  id: string
  slug: string
  type: RecipeType
  status: RecipeStatus
  authenticity: AuthenticityClass
  styleId: string | null
  styleName: LocalizedText | null
  ovenProfileId: string | null
  ovenName: LocalizedText | null
  name: LocalizedText
  summary: LocalizedText | null
  activeMinutes: number | null
  passiveMinutes: number | null
  difficulty: number | null
  tags: string[]
  source: SourceView | null
  /** Count of unresolved review flags, surfaced on the card. */
  openQuestions: number
  hasConflict: boolean
}

export interface RecipeDetail extends RecipeSummary {
  baseYield: string | null
  yieldUnit: Unit | null
  baseDiameterMm: number | null
  baseShape: Shape | null
  baseTrayWidthMm: number | null
  baseTrayHeightMm: number | null
  baseBallWeightG: string | null
  notes: LocalizedText | null
  items: RecipeItemView[]
  steps: RecipeStepView[]
  evidence: EvidenceView[]
  /** Recipes that use this one as a component. */
  usedBy: { id: string; slug: string; name: LocalizedText }[]
}

export interface PantryItemView {
  id: string
  ingredientId: string
  ingredientName: LocalizedText
  amount: Amount
  location: StorageLocation
  openedAt: string | null
  purchasedAt: string | null
  expiresAt: string | null
  recognizedProductName: string | null
}

export interface PlanEntry {
  id: string
  recipeId: string
  count: number
  shape: Shape
  diameterMm: number | null
  trayWidthMm: number | null
  trayHeightMm: number | null
  ballWeightG: string | null
  scaleMode: 'area' | 'portion'
  doughRecipeId: string | null
  sauceRecipeId: string | null
}

export interface MealPlanView {
  id: string
  serveAt: string | null
  notes: string | null
  entries: PlanEntry[]
}

export interface CookSessionView {
  id: string
  recipeId: string
  recipeName: LocalizedText
  startedAt: string
  finishedAt: string | null
  scaleFactor: string
  rating: number | null
  notes: string | null
  completedStepIds: string[]
}

export interface CategoryView {
  id: string
  name: LocalizedText
  sortOrder: number
}

export interface UserSettingsView {
  locale: Locale
  temperatureUnit: 'c' | 'f'
  defaultDiameterMm: number
  defaultBallWeightG: number
  defaultOvenProfileId: string | null
  includeExperimental: boolean
}

export interface RecipeFilter {
  query?: string
  type?: RecipeType | null
  styleId?: string | null
  authenticity?: AuthenticityClass | null
  status?: RecipeStatus | null
  ovenProfileId?: string | null
}

/**
 * Everything the app reads and writes goes through this interface, which is
 * what lets demo mode and Supabase be swapped without a single screen knowing
 * which one is active.
 */
export interface Repository {
  readonly kind: 'demo' | 'supabase'

  listRecipes(locale: Locale, filter?: RecipeFilter): Promise<RecipeSummary[]>
  getRecipe(locale: Locale, slug: string): Promise<RecipeDetail | null>
  getGraph(): Promise<RecipeGraph>
  listIngredients(locale: Locale): Promise<IngredientView[]>
  listCategories(locale: Locale): Promise<CategoryView[]>
  listPackageOptions(): Promise<PackageOption[]>
  listSubstitutions(): Promise<Substitution[]>
  listStyles(locale: Locale): Promise<{ id: string; name: LocalizedText }[]>
  listOvenProfiles(locale: Locale): Promise<{ id: string; name: LocalizedText }[]>

  getPantry(locale: Locale): Promise<PantryItemView[]>
  addPantryItem(input: {
    ingredientId: string
    amount: Amount
    location: StorageLocation
    expiresAt?: string | null
  }): Promise<void>
  removePantryItem(id: string): Promise<void>

  getPlan(): Promise<MealPlanView>
  savePlan(plan: MealPlanView): Promise<void>

  listCookSessions(locale: Locale): Promise<CookSessionView[]>
  saveCookSession(session: CookSessionView): Promise<void>

  getSettings(): Promise<UserSettingsView>
  saveSettings(settings: Partial<UserSettingsView>): Promise<void>
}
