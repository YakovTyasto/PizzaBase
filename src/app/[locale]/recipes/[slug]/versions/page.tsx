import { History } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Locale } from '@/domain'
import { VersionComparison } from '@/components/versions/version-comparison'
import { EmptyState } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { getRepository } from '@/lib/data'
import { diffDrafts, doughSummaryOf } from '@/lib/data/diff'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'versions' })
  return { title: t('title') }
}

/**
 * Version history and comparison.
 *
 * The diff is computed on the server from two drafts, so the client receives
 * the finished comparison rather than two full recipes to diff itself.
 */
export default async function VersionsPage({
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
  const query = await searchParams

  const [recipe, current] = await Promise.all([
    repository.getRecipe(locale as Locale, slug),
    repository.getRecipeDraft(slug),
  ])
  if (!recipe || !current) notFound()

  const versions = await repository.listVersions(recipe.id)

  const compareId = typeof query.compare === 'string' ? query.compare : versions[0]?.id
  const older = compareId ? await repository.getVersionDraft(compareId) : null

  const diff = older ? diffDrafts(older, current) : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-ink-faint text-sm">{recipe.name.value}</p>
          <h1 className="font-display text-2xl font-semibold">{t('versions.title')}</h1>
        </div>
        <Link href={`/recipes/${slug}`}>
          <Button variant="outline" size="sm">
            {t('common.back')}
          </Button>
        </Link>
      </div>

      {versions.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" />}
          title={t('versions.empty')}
          hint={t('versions.emptyHint')}
        />
      ) : (
        <VersionComparison
          slug={slug}
          versions={versions.map((version) => ({
            id: version.id,
            number: version.versionNumber,
            createdAt: version.createdAt,
            isPrimary: version.isPrimary,
            note: version.note,
          }))}
          selectedId={compareId ?? null}
          diff={diff}
          doughBefore={older ? doughSummaryOf(older) : null}
          doughAfter={doughSummaryOf(current)}
        />
      )}
    </div>
  )
}
