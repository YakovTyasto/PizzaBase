import { Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { allowedSubstitutions, isNumeric, recommend } from '@/domain'
import { RecommendationList } from '@/components/recommend/recommendation-list'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { getRepository } from '@/lib/data'
import { serializeAmount } from '@/lib/data/serialize'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'recommendations' })
  return { title: t('title') }
}

/**
 * "Cook with what I have".
 *
 * The candidate set, the coverage figures and the missing list are all computed
 * by the domain layer. No model is involved in deciding what you can cook, and
 * substitutions come only from the curated approved list -- which is why the
 * app will suggest adding tomatoes to the shopping list rather than proposing
 * something that does not belong on a pizza.
 */
export default async function RecommendationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const query = await searchParams
  const includeExperimental = query.experimental === '1'

  const t = await getTranslations()
  const repository = getRepository()

  const [recipes, graph, pantry, ingredients, substitutions, settings] = await Promise.all([
    repository.listRecipes(locale as Locale),
    repository.getGraph(),
    repository.getPantry(locale as Locale),
    repository.listIngredients(locale as Locale),
    repository.listSubstitutions(),
    repository.getSettings(),
  ])

  const pantryEntries = pantry
    .filter((entry) => isNumeric(entry.amount))
    .map((entry) => ({ ingredientId: entry.ingredientId, amount: entry.amount }))

  const candidates = recipes
    .filter((recipe) => recipe.type === 'pizza')
    .map((recipe) => ({
      recipeId: recipe.id,
      authenticity: recipe.authenticity,
      status: recipe.status,
      styleId: recipe.styleId,
      sourceCredibility: recipe.source?.credibilityTier ?? 0.4,
      totalMinutes: (recipe.activeMinutes ?? 0) + (recipe.passiveMinutes ?? 0) || null,
      ovenProfileId: recipe.ovenProfileId,
    }))

  const results = recommend(graph, candidates, pantryEntries, {
    includeExperimental,
    ovenProfileId: settings.defaultOvenProfileId,
    limit: 12,
  })

  const ingredientNames = Object.fromEntries(
    ingredients.map((ingredient) => [ingredient.id, ingredient.name.value]),
  )
  const recipesById = Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe]))

  if (pantry.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-semibold">{t('recommendations.title')}</h1>
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title={t('recommendations.empty')}
          hint={t('recommendations.emptyHint')}
          action={
            <Link href="/pantry">
              <Button>{t('pantry.add')}</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">{t('recommendations.title')}</h1>

      <RecommendationList
        includeExperimental={includeExperimental}
        results={results.map((result) => {
          const recipe = recipesById[result.recipeId]
          return {
            recipeId: result.recipeId,
            slug: recipe?.slug ?? result.recipeId,
            name: recipe?.name.value ?? result.recipeId,
            styleName: recipe?.styleName?.value ?? null,
            authenticity: result.reasons.find((r) => r.kind === 'authenticity')?.value ?? null,
            canCookNow: result.canCookNow,
            dataComplete: result.dataComplete,
            unknownRequired: result.unknownRequired.map((entry) => ({
              ingredientId: entry.ingredientId,
              name: ingredientNames[entry.ingredientId] ?? entry.ingredientId,
            })),
            unknownOptional: result.unknownOptional.map((entry) => ({
              ingredientId: entry.ingredientId,
              name: ingredientNames[entry.ingredientId] ?? entry.ingredientId,
            })),
            coverage: Math.round(result.coverage * 100),
            reasons: result.reasons.map((reason) => ({
              kind: reason.kind,
              value: 'value' in reason ? String(reason.value) : null,
              minutes: 'minutes' in reason ? reason.minutes : null,
            })),
            missing: result.missing.map((missing) => ({
              ingredientId: missing.ingredientId,
              name: ingredientNames[missing.ingredientId] ?? missing.ingredientId,
              short: missing.short ? serializeAmount(missing.short) : null,
              optional: missing.optional,
              // Only approved, style-compatible swaps ever reach the screen.
              substitutions: allowedSubstitutions(
                substitutions,
                missing.ingredientId,
                recipe?.styleId ?? null,
              ).map((substitution) => ({
                name: ingredientNames[substitution.toIngredientId] ?? substitution.toIngredientId,
                grade: substitution.qualityGrade,
                explanation: substitution.explanationKey,
              })),
            })),
          }
        })}
      />
    </div>
  )
}
