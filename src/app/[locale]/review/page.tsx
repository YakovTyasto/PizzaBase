import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { NeedsReviewList } from '@/components/review/needs-review-list'
import { EmptyState } from '@/components/ui/primitives'
import { getRepository } from '@/lib/data'
import { serializeAmount } from '@/lib/data/serialize'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'review' })
  return { title: t('title') }
}

/**
 * Everything the app does not know, in one place.
 *
 * Each entry is a single field the owner can settle once, after which every
 * dependent calculation follows. Nothing here proposes a value as confirmed --
 * the whole point is that the app is asking rather than guessing.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const repository = getRepository()

  const [questions, packages, ingredients] = await Promise.all([
    repository.listOpenQuestions(locale as Locale),
    repository.listPackageOptions(),
    repository.listIngredients(locale as Locale),
  ])

  if (questions.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-semibold">{t('review.title')}</h1>
        <EmptyState
          icon={<CheckCircle2 className="size-6" />}
          title={t('review.empty')}
          hint={t('review.emptyHint')}
        />
      </div>
    )
  }

  const ingredientNames = Object.fromEntries(
    ingredients.map((ingredient) => [ingredient.id, ingredient.name.value]),
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t('review.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('review.count', { count: questions.length })}
        </p>
      </div>

      <NeedsReviewList
        questions={questions.map((question) => ({
          id: question.id,
          recipeSlug: question.recipeSlug,
          recipeName: question.recipeName.value,
          itemKey: question.itemKey,
          subject: question.subject.value,
          field: question.field,
          reviewState: question.reviewState,
          note: question.note?.value ?? null,
          kind: question.kind,
          currentAmount: question.currentAmount
            ? serializeAmount(question.currentAmount)
            : null,
        }))}
        packageOptions={packages.map((option) => ({
          id: option.id,
          ingredientId: option.ingredientId,
          ingredientName: ingredientNames[option.ingredientId] ?? option.ingredientId,
          label: option.label,
          netAmount: serializeAmount(option.netAmount),
        }))}
      />
    </div>
  )
}
