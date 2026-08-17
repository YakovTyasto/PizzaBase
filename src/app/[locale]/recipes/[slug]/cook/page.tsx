import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Locale } from '@/domain'
import { CookingMode } from '@/components/cooking/cooking-mode'
import { EmptyState } from '@/components/ui/primitives'
import { getRepository } from '@/lib/data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'cooking' })
  return { title: t('title') }
}

export default async function CookPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const recipe = await getRepository().getRecipe(locale as Locale, slug)
  if (!recipe) notFound()

  if (recipe.steps.length === 0) {
    return (
      <EmptyState title={t('recipe.noSteps')} hint={t('recipe.noStepsHint')} />
    )
  }

  return (
    <CookingMode
      recipeId={recipe.id}
      recipeName={recipe.name.value}
      steps={recipe.steps.map((step) => ({
        id: step.id,
        phase: step.phase,
        instruction: step.instruction.value,
        cues: step.cues?.value ?? null,
        troubleshooting: step.troubleshooting?.value ?? null,
        activeMinutes: step.activeMinutes,
        waitMinMinutes: step.waitMinMinutes,
        waitMaxMinutes: step.waitMaxMinutes,
        temperatureC: step.temperatureC,
        itemNames: step.itemIds.flatMap((id) => {
          const item = recipe.items.find((candidate) => candidate.id === id)
          return item ? [item.name.value] : []
        }),
      }))}
    />
  )
}
