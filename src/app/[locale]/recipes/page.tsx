import { Plus, Search } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type {
  AuthenticityClass,
  Locale,
  RecipeStatus,
  RecipeType,
} from '@/domain'
import { RecipeCard } from '@/components/recipe/recipe-card'
import { RecipeFilters } from '@/components/recipe/recipe-filters'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { getRepository } from '@/lib/data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'recipes' })
  return { title: t('title') }
}

/** Filters live in the URL so a filtered view can be shared and restored. */
export default async function RecipesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const query = await searchParams
  const single = (key: string) => {
    const value = query[key]
    return typeof value === 'string' && value ? value : null
  }

  const t = await getTranslations()
  const repository = getRepository()

  const filter = {
    query: single('q') ?? undefined,
    type: (single('type') as RecipeType | null) ?? null,
    styleId: single('style'),
    authenticity: (single('class') as AuthenticityClass | null) ?? null,
    status: (single('status') as RecipeStatus | null) ?? null,
    ovenProfileId: single('oven'),
  }

  const [recipes, styles, ovens] = await Promise.all([
    repository.listRecipes(locale as Locale, filter),
    repository.listStyles(locale as Locale),
    repository.listOvenProfiles(locale as Locale),
  ])

  const hasFilters = Object.values(filter).some(Boolean)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t('recipes.title')}</h1>
        <Link href="/import?tab=manual" className="hidden sm:block">
          <Button>
            <Plus aria-hidden className="size-4" />
            {t('recipes.create')}
          </Button>
        </Link>
      </div>

      <RecipeFilters styles={styles} ovens={ovens} />

      <p className="text-sm text-ink-muted">{t('recipes.resultCount', { count: recipes.length })}</p>

      {recipes.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title={t('recipes.empty')}
          hint={hasFilters ? t('recipes.emptyHintClear') : t('recipes.emptyHintImport')}
          action={
            hasFilters ? (
              <Link href="/recipes">
                <Button variant="outline">{t('common.clear')}</Button>
              </Link>
            ) : (
              <Link href="/import">
                <Button>{t('import.title')}</Button>
              </Link>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
