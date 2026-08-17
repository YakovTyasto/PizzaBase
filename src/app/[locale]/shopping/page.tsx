import { ShoppingBasket } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { RecipeCycleError, buildShoppingList, expandMany, isNumeric } from '@/domain'
import { ShoppingList } from '@/components/shopping/shopping-list'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { getRepository } from '@/lib/data'
import { serializeAmount } from '@/lib/data/serialize'
import { planRequests } from '@/lib/plan-math'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'shopping' })
  return { title: t('title') }
}

/**
 * The consolidated shopping list.
 *
 * Computed fresh from the plan and the pantry on every visit: the plan and what
 * is at home are the source of truth, so a stale snapshot can never be shown.
 */
export default async function ShoppingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const repository = getRepository()

  const [plan, graph, pantry, packages, ingredients, categories] = await Promise.all([
    repository.getPlan(),
    repository.getGraph(),
    repository.getPantry(locale as Locale),
    repository.listPackageOptions(),
    repository.listIngredients(locale as Locale),
    repository.listCategories(locale as Locale),
  ])

  if (plan.entries.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-semibold">{t('shopping.title')}</h1>
        <EmptyState
          icon={<ShoppingBasket className="size-6" />}
          title={t('shopping.empty')}
          hint={t('shopping.emptyHint')}
          action={
            <Link href="/plan">
              <Button>{t('plan.title')}</Button>
            </Link>
          }
        />
      </div>
    )
  }

  let items: ReturnType<typeof buildShoppingList>['items'] = []
  let cycleError: string | null = null

  try {
    const requests = planRequests(graph, plan.entries)
    const { lines } = expandMany(graph, requests)
    const pantryEntries = pantry
      .filter((entry) => isNumeric(entry.amount))
      .map((entry) => ({ ingredientId: entry.ingredientId, amount: entry.amount }))

    items = buildShoppingList(graph, lines, pantryEntries, packages).items
  } catch (error) {
    if (error instanceof RecipeCycleError) cycleError = error.path.join(' → ')
    else throw error
  }

  const ingredientsById = Object.fromEntries(
    ingredients.map((ingredient) => [
      ingredient.id,
      { name: ingredient.name.value, categoryId: ingredient.categoryId },
    ]),
  )
  const categoryNames = Object.fromEntries(
    categories.map((category) => [category.id, category.name.value]),
  )
  const recipeNames = Object.fromEntries(
    (await repository.listRecipes(locale as Locale)).map((r) => [r.id, r.name.value]),
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t('shopping.title')}</h1>
        <Link href="/plan">
          <Button variant="outline" size="sm">
            {t('plan.title')}
          </Button>
        </Link>
      </div>

      {cycleError ? (
        <p role="alert" className="rounded-lg bg-tomato-soft px-3 py-2 text-sm text-tomato-strong">
          {t('errors.cycleHint', { chain: cycleError })}
        </p>
      ) : (
        <ShoppingList
          items={items.map((item) => ({
            ingredientId: item.ingredientId,
            required: item.required ? serializeAmount(item.required) : null,
            available: item.available ? serializeAmount(item.available) : null,
            toBuy: item.toBuy ? serializeAmount(item.toBuy) : null,
            optional: item.optional,
            fullyCovered: item.fullyCovered,
            separate: item.separate.map((line) => ({
              amount: serializeAmount(line.amount),
              chain: line.provenance.map((step) => step.recipeId),
            })),
            packages: item.packages
              ? {
                  label: item.packages.label,
                  count: item.packages.count,
                  net: serializeAmount(item.packages.packageNet),
                  leftover: item.packages.leftover
                    ? serializeAmount(item.packages.leftover)
                    : null,
                }
              : null,
            provenance: item.provenance.map((line) => ({
              chain: line.provenance.map((step) => step.recipeId),
              amount: serializeAmount(line.amount),
            })),
          }))}
          ingredients={ingredientsById}
          categoryNames={categoryNames}
          recipeNames={recipeNames}
        />
      )}
    </div>
  )
}
