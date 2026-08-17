import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Locale } from '@/domain'
import { RecipeEditor } from '@/components/editor/recipe-editor'
import { loadEditorOptions } from '@/components/editor/load-options'
import { getRepository } from '@/lib/data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return { title: `${t('edit')} · ${slug}` }
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const repository = getRepository()

  const [draft, options] = await Promise.all([
    repository.getRecipeDraft(slug),
    loadEditorOptions(locale as Locale, slug),
  ])

  if (!draft) notFound()

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">
        {t('common.edit')}: {draft.names[locale as Locale] || draft.names.ru || slug}
      </h1>
      <RecipeEditor initial={draft} options={options} isNew={false} />
    </div>
  )
}
