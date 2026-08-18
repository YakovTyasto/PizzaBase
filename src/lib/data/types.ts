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
import type { RecipeDraft } from './recipe-draft'

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

export interface RecipeVersionView {
  id: string
  recipeId: string
  versionNumber: number
  createdAt: string
  isPrimary: boolean
  note: string | null
}

/** One field that still needs the owner's decision. */
export interface OpenQuestionView {
  id: string
  recipeId: string
  recipeSlug: string
  recipeName: LocalizedText
  /** Which item the question is about, when it is not about the recipe itself. */
  itemId: string | null
  itemKey: string | null
  subject: LocalizedText
  field: string
  reviewState: ReviewState
  conflictGroup: string | null
  note: LocalizedText | null
  /** Present when the question is "what amount?", so the UI can offer an input. */
  currentAmount: Amount | null
  kind: 'amount' | 'yield' | 'ingredient' | 'other'
}

export interface SaveRecipeResult {
  slug: string
  created: boolean
  versionCreated: boolean
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

  // --- Recipe authoring ----------------------------------------------------

  /**
   * Creates or replaces a recipe. Implementations must be all-or-nothing: a
   * failure part-way through must not leave a half-written recipe behind.
   */
  saveRecipe(draft: RecipeDraft): Promise<SaveRecipeResult>
  deleteRecipe(slug: string): Promise<void>
  /** The draft shape of an existing recipe, for the editor to load. */
  getRecipeDraft(slug: string): Promise<RecipeDraft | null>

  // --- Versions ------------------------------------------------------------

  listVersions(recipeId: string): Promise<RecipeVersionView[]>
  getVersionDraft(versionId: string): Promise<RecipeDraft | null>
  makeVersionPrimary(versionId: string): Promise<void>

  // --- Review --------------------------------------------------------------

  listOpenQuestions(locale: Locale): Promise<OpenQuestionView[]>

  // --- Ingredients ---------------------------------------------------------

  /** Creates a canonical ingredient. Returns the slug it was given. */
  createIngredient(input: {
    names: Record<Locale, string>
    categorySlug: string
    measure: string
    baseUnit: Unit
    aliases?: string[]
  }): Promise<string>

  // --- Idempotency ---------------------------------------------------------

  /*
   * A ledger of writes already applied, keyed by an idempotency key the caller
   * derives from the content. It backs two things that look different but are
   * the same problem: approving an import twice, and replaying a queued offline
   * draft whose response was lost. Both must resolve to the recipe that already
   * exists rather than making a second one.
   */

  /** The slug written under this key, or null when it has not been used. */
  findAppliedMutation(idempotencyKey: string): Promise<string | null>
  recordAppliedMutation(idempotencyKey: string, slug: string): Promise<void>
}
