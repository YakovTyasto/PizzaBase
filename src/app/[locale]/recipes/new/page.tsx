import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale, RecipeType } from '@/domain'
import { RecipeEditor } from '@/components/editor/recipe-editor'
import { emptyDraft } from '@/components/editor/editor-types'
import { loadEditorOptions } from '@/components/editor/load-options'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'recipes' })
  return { title: t('create') }
}

const TYPES: RecipeType[] = ['pizza', 'dough', 'sauce', 'prep']

export default async function NewRecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const query = await searchParams
  const requested = typeof query.type === 'string' ? query.type : 'pizza'
  const type = (TYPES as string[]).includes(requested) ? (requested as RecipeType) : 'pizza'

  const t = await getTranslations()
  const options = await loadEditorOptions(locale as Locale)

  const draft = emptyDraft(type)
  draft.originLocale = locale as Locale

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">{t('recipes.create')}</h1>
      <RecipeEditor initial={draft} options={options} isNew />
    </div>
  )
}
