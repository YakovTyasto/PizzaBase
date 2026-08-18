import { Plus, Search } from 'lucide-react'
import { signCovers } from '@/lib/data/sign-media'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { AuthenticityClass, Locale, RecipeStatus, RecipeType } from '@/domain'
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

  const [styles, ovens] = await Promise.all([
    repository.listStyles(locale as Locale),
    repository.listOvenProfiles(locale as Locale),
  ])

  /**
   * A filter value is only applied if it still means something.
   *
   * Filters live in the URL so a view can be shared and restored, which means a
   * bookmark can outlive the style it names, and switching locale carries the
   * whole query string across. An unrecognised value used to be passed straight
   * to the repository, which matched nothing -- so the library looked empty
   * when in fact the *filter* was stale. Dropping it shows the catalog and says
   * so, instead of hiding fourteen recipes behind a dead parameter.
   */
  const known = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
    value && (allowed as readonly string[]).includes(value) ? (value as T) : null

  const requested = {
    type: single('type'),
    style: single('style'),
    class: single('class'),
    status: single('status'),
    oven: single('oven'),
  }

  const filter = {
    query: single('q') ?? undefined,
    type: known<RecipeType>(requested.type, ['pizza', 'dough', 'sauce', 'prep']),
    styleId: known(
      requested.style,
      styles.map((style) => style.id),
    ),
    authenticity: known<AuthenticityClass>(requested.class, [
      'traditional',
      'pizzaiolo',
      'modern_italian',
      'adapted',
      'experimental',
      'user_verified',
    ]),
    status: known<RecipeStatus>(requested.status, [
      'draft',
      'needs_review',
      'verified',
      'archived',
    ]),
    ovenProfileId: known(
      requested.oven,
      ovens.map((oven) => oven.id),
    ),
  }

  const droppedFilters = [
    requested.type && !filter.type,
    requested.style && !filter.styleId,
    requested.class && !filter.authenticity,
    requested.status && !filter.status,
    requested.oven && !filter.ovenProfileId,
  ].some(Boolean)

  const recipes = await signCovers(await repository.listRecipes(locale as Locale, filter))

  const hasFilters = Object.values(filter).some(Boolean)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t('recipes.title')}</h1>
        <Link href="/recipes/new" className="hidden sm:block">
          <Button>
            <Plus aria-hidden className="size-4" />
            {t('recipes.create')}
          </Button>
        </Link>
      </div>

      <RecipeFilters styles={styles} ovens={ovens} />

      {droppedFilters ? (
        <p role="status" className="bg-amber-soft text-amber rounded-lg px-3 py-2 text-sm">
          {t('recipes.filterCleared')}
        </p>
      ) : null}

      <p className="text-ink-muted text-sm">
        {t('recipes.resultCount', { count: recipes.length })}
      </p>

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
              <Link href="/recipes/new">
                <Button>{t('recipes.create')}</Button>
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
