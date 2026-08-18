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
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const repository = getRepository()
  const recipe = await repository.getRecipe(locale as Locale, slug)
  if (!recipe) notFound()

  const query = await searchParams
  // Carried from the recipe page's scaler, so the record of the cook says how
  // much was actually made rather than assuming a single batch.
  const rawScale = typeof query.scale === 'string' ? query.scale : '1'
  const scale = /^\d+(\.\d+)?$/.test(rawScale) && Number(rawScale) > 0 ? rawScale : '1'

  const versions = await repository.listVersions(recipe.id)

  if (recipe.steps.length === 0) {
    return (
      <EmptyState title={t('recipe.noSteps')} hint={t('recipe.noStepsHint')} />
    )
  }

  return (
    <CookingMode
      recipeId={recipe.id}
      recipeSlug={recipe.slug}
      recipeName={recipe.name.value}
      // The version actually being followed, so the result records what was
      // cooked rather than whatever the recipe says by the time it is read.
      versionId={versions.find((version) => version.isPrimary)?.id ?? null}
      scaleFactor={scale}
      plannedActiveMinutes={recipe.activeMinutes}
      plannedPassiveMinutes={recipe.passiveMinutes}
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
