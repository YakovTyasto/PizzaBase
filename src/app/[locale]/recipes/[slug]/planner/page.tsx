import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { type Locale, hasSchedulableTiming } from '@/domain'
import { FermentationPlanner } from '@/components/planner/fermentation-planner'
import { EmptyState } from '@/components/ui/primitives'
import { getRepository } from '@/lib/data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'planner' })
  return { title: t('title') }
}

export default async function PlannerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const recipe = await getRepository().getRecipe(locale as Locale, slug)
  if (!recipe) notFound()

  // Only a recipe with real waiting has anything to schedule backwards from.
  // A raw sauce is four hands-on steps in a row; a "fermentation planner" for
  // it would promise a calculation the recipe cannot support.
  const plannerSteps = recipe.steps.map((step, index) => ({
    id: step.id,
    sortOrder: index,
    phase: step.phase,
    activeMinutes: step.activeMinutes,
    waitMinMinutes: step.waitMinMinutes,
    waitMaxMinutes: step.waitMaxMinutes,
    durationKnown: step.durationKnown,
    instruction: step.instruction.value,
    cues: step.cues?.value ?? null,
  }))

  if (!hasSchedulableTiming(plannerSteps)) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-semibold">{t('planner.title')}</h1>
        <EmptyState title={t('planner.noFermentation')} hint={t('planner.noFermentationHint')} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-faint text-sm">{recipe.name.value}</p>
        <h1 className="font-display text-2xl font-semibold">{t('planner.title')}</h1>
      </div>
      <FermentationPlanner recipeName={recipe.name.value} steps={plannerSteps} />
    </div>
  )
}
