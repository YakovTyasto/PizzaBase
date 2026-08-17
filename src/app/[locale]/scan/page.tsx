import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { ProductScanner } from '@/components/scan/product-scanner'
import { getRepository } from '@/lib/data'
import { providerStatuses } from '@/lib/providers/registry'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'scanner' })
  return { title: t('title') }
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const ingredients = await getRepository().listIngredients(locale as Locale)
  const statuses = providerStatuses()

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">{t('scanner.title')}</h1>
      <ProductScanner
        ingredients={ingredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.name.value,
          baseUnit: ingredient.baseUnit,
        }))}
        visionAvailable={statuses.vision.available}
        visionRequiredKey={statuses.vision.requiredKey ?? null}
      />
    </div>
  )
}
