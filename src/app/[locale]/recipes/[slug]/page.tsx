import { CalendarPlus, ChefHat, ExternalLink, History, Pencil, Timer } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { DomainIngredient, Locale } from '@/domain'
import { EvidencePanel } from '@/components/recipe/evidence-panel'
import { RecipeScaler } from '@/components/recipe/recipe-scaler'
import { StepList } from '@/components/recipe/step-list'
import {
  AuthenticityBadge,
  FallbackBadge,
  ReviewBadge,
  StatusBadge,
} from '@/components/recipe/badges'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, DataRow, SectionHeading } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { getRepository } from '@/lib/data'
import { serializeGraphFor } from '@/lib/data/serialize'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const recipe = await getRepository().getRecipe(locale as Locale, slug)
  return { title: recipe?.name.value ?? slug }
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const repository = getRepository()

  const [recipe, graph, ingredients] = await Promise.all([
    repository.getRecipe(locale as Locale, slug),
    repository.getGraph(),
    repository.listIngredients(locale as Locale),
  ])

  if (!recipe) notFound()

  const ingredientNames = Object.fromEntries(
    ingredients.map((ingredient) => [ingredient.id, ingredient.name.value]),
  )
  const recipeNames = Object.fromEntries(
    [recipe, ...recipe.usedBy].map((entry) => [entry.id, entry.name.value]),
  )
  // Component names come from the item rows, which already resolved them.
  for (const item of recipe.items) {
    if (item.componentRecipeId) recipeNames[item.componentRecipeId] = item.name.value
  }

  const domainIngredients = ingredients.map((ingredient) => ({
    id: ingredient.id,
    slug: ingredient.slug,
    measure: ingredient.measure as DomainIngredient['measure'],
    baseUnit: ingredient.baseUnit,
    densityGPerMl: ingredient.densityGPerMl,
    categoryId: ingredient.categoryId,
  }))

  const totalMinutes = (recipe.activeMinutes ?? 0) + (recipe.passiveMinutes ?? 0)

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{t(`recipeType.${recipe.type}`)}</Badge>
          <AuthenticityBadge value={recipe.authenticity} />
          <StatusBadge status={recipe.status} />
          <ReviewBadge openQuestions={recipe.openQuestions} hasConflict={recipe.hasConflict} />
        </div>

        <h1 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">
          {recipe.name.value}
          <FallbackBadge text={recipe.name} />
        </h1>

        {recipe.summary ? (
          <p className="max-w-2xl text-ink-muted">{recipe.summary.value}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href={`/recipes/${recipe.slug}/cook`}>
            <Button>
              <ChefHat aria-hidden />
              {t('recipe.startCooking')}
            </Button>
          </Link>
          <Link href={`/plan?add=${recipe.slug}`}>
            <Button variant="outline">
              <CalendarPlus aria-hidden />
              {t('recipe.addToPlan')}
            </Button>
          </Link>
          {recipe.steps.length > 0 ? (
            <Link href={`/recipes/${recipe.slug}/planner`}>
              <Button variant="outline">
                <Timer aria-hidden />
                {t('planner.title')}
              </Button>
            </Link>
          ) : null}
          <Link href={`/recipes/${recipe.slug}/edit`}>
            <Button variant="outline">
              <Pencil aria-hidden />
              {t('common.edit')}
            </Button>
          </Link>
          <Link href={`/recipes/${recipe.slug}/versions`}>
            <Button variant="outline">
              <History aria-hidden />
              {t('versions.title')}
            </Button>
          </Link>
        </div>
      </header>

      {/*
        The scaler is the interactive core: it recomputes amounts, nested
        components and baker's percentages entirely client-side from the same
        pure domain functions the server uses.
      */}
      <RecipeScaler
        recipe={recipe}
        graph={serializeGraphFor(graph, [recipe.id], domainIngredients)}
        ingredientNames={ingredientNames}
        recipeNames={recipeNames}
      />

      <section>
        <SectionHeading>{t('recipe.steps')}</SectionHeading>
        <StepList steps={recipe.steps} items={recipe.items} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionHeading>{t('recipe.source')}</SectionHeading>
          <Card>
            <CardBody>
              <dl>
                <DataRow label={t('recipe.style')}>{recipe.styleName?.value ?? '—'}</DataRow>
                <DataRow label={t('recipe.oven')}>{recipe.ovenName?.value ?? '—'}</DataRow>
                <DataRow label={t('recipe.totalTime')}>
                  {totalMinutes > 0
                    ? totalMinutes >= 60
                      ? t('common.hours', { count: Math.round(totalMinutes / 60) })
                      : t('common.minutes', { count: totalMinutes })
                    : '—'}
                </DataRow>
                {recipe.source ? (
                  <>
                    <DataRow label={t('recipe.attribution')}>
                      {recipe.source.author ?? recipe.source.sourceType}
                    </DataRow>
                    {recipe.source.url ? (
                      <div className="pt-2">
                        <a
                          href={recipe.source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 text-sm text-tomato underline underline-offset-2"
                        >
                          <ExternalLink aria-hidden className="size-3.5" />
                          {recipe.source.title ?? t('recipe.openSource')}
                        </a>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </dl>
              {recipe.notes ? (
                <p className="mt-3 border-t border-rule pt-3 text-sm text-ink-muted">
                  {recipe.notes.value}
                </p>
              ) : null}
              {recipe.usedBy.length > 0 ? (
                <div className="mt-3 border-t border-rule pt-3">
                  <p className="mb-1.5 text-xs text-ink-faint">{t('recipes.usedBy')}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {recipe.usedBy.map((parent) => (
                      <li key={parent.id}>
                        <Link href={`/recipes/${parent.slug}`}>
                          <Badge tone="outline">{parent.name.value}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </section>

        <section>
          <SectionHeading>{t('recipe.evidence')}</SectionHeading>
          <EvidencePanel evidence={recipe.evidence} items={recipe.items} />
        </section>
      </div>
    </article>
  )
}
