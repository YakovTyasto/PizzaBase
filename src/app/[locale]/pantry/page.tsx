import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { PantryManager } from '@/components/pantry/pantry-manager'
import { getRepository } from '@/lib/data'
import { serializeAmount } from '@/lib/data/serialize'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pantry' })
  return { title: t('title') }
}

export default async function PantryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const repository = getRepository()

  const [pantry, ingredients] = await Promise.all([
    repository.getPantry(locale as Locale),
    repository.listIngredients(locale as Locale),
  ])

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">{t('pantry.title')}</h1>
      <PantryManager
        writable={repository.writable}
        items={pantry.map((item) => ({
          id: item.id,
          ingredientId: item.ingredientId,
          name: item.ingredientName.value,
          amount: serializeAmount(item.amount),
          location: item.location,
          expiresAt: item.expiresAt,
        }))}
        ingredients={ingredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name.value,
          baseUnit: ingredient.baseUnit,
          measure: ingredient.measure,
        }))}
      />
    </div>
  )
}
