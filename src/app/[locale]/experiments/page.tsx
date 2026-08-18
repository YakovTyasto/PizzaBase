import { FlaskConical } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { ExperimentWorkbench } from '@/components/experiments/experiment-workbench'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, EmptyState, Select } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { getRepository } from '@/lib/data'
import { compareDrafts } from '@/lib/data/experiment'
import { formatDateTime } from '@/lib/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'experiments' })
  return { title: t('title') }
}

/**
 * Experiments.
 *
 * Pick a recipe that has more than one version, put two or more of them side
 * by side, and record what you concluded. The comparison is computed here from
 * the stored drafts -- ordinary arithmetic on the ingredients, not a summary
 * from a model.
 */
export default async function ExperimentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const repository = getRepository()
  const query = await searchParams

  const [recipes, saved] = await Promise.all([
    repository.listRecipes(locale as Locale),
    repository.listExperiments(locale as Locale),
  ])

  const withVersions = await Promise.all(
    recipes.map(async (recipe) => ({
      recipe,
      versions: await repository.listVersions(recipe.id),
    })),
  )

  // Every recipe stays in the picker. A recipe with no history is a perfectly
  // reasonable thing to select and be told there is nothing to compare yet --
  // quietly swapping it for a different recipe would be worse.
  const comparable = withVersions
  const requestedSlug = typeof query.recipe === 'string' ? query.recipe : null
  const active =
    comparable.find((entry) => entry.recipe.slug === requestedSlug) ??
    comparable.find((entry) => entry.versions.length > 0) ??
    comparable[0] ??
    null

  if (!active) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-semibold">{t('experiments.title')}</h1>
        <EmptyState
          icon={<FlaskConical className="size-6" />}
          title={t('experiments.empty')}
          hint={t('experiments.emptyHint')}
          action={
            <Link href="/recipes">
              <Button>{t('recipes.title')}</Button>
            </Link>
          }
        />
      </div>
    )
  }

  // Versions plus the recipe as it stands now, which is usually one of the
  // two things being compared.
  const options = [
    { id: 'current', label: t('versions.current'), isPrimary: true },
    ...active.versions.map((version) => ({
      id: version.id,
      label: `${t('versions.version', { number: version.versionNumber })} · ${formatDateTime(
        new Date(version.createdAt),
        locale as Locale,
      )}`,
      isPrimary: version.isPrimary,
    })),
  ]

  const requested =
    typeof query.versions === 'string'
      ? query.versions.split(',').filter((id) => options.some((option) => option.id === id))
      : []
  const selectedIds =
    requested.length >= 2 ? requested : ['current', options[1]?.id ?? 'current'].filter(Boolean)

  const drafts = await Promise.all(
    selectedIds.map((id) =>
      id === 'current'
        ? repository.getRecipeDraft(active.recipe.slug)
        : repository.getVersionDraft(id),
    ),
  )
  const usable = drafts.filter((draft): draft is NonNullable<typeof draft> => draft !== null)
  // Comparing the current recipe with itself proves nothing, so a recipe
  // without at least one snapshot has nothing to show.
  const rows = active.versions.length >= 1 && usable.length >= 2 ? compareDrafts(usable) : []

  const existing =
    saved.find(
      (experiment) =>
        experiment.recipeSlug === active.recipe.slug &&
        experiment.versionIds.join(',') === selectedIds.join(','),
    ) ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">{t('experiments.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('experiments.hint')}</p>
      </div>

      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className="min-w-48 flex-1">
              <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                {t('recipes.title')}
              </span>
              <Select name="recipe" defaultValue={active.recipe.slug}>
                {comparable.map((entry) => (
                  <option key={entry.recipe.slug} value={entry.recipe.slug}>
                    {entry.recipe.name.value}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" variant="outline">
              {t('common.apply')}
            </Button>
          </form>
        </CardBody>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="size-6" />}
          title={t('experiments.needTwo')}
          hint={t('experiments.needTwoHint')}
        />
      ) : (
        <ExperimentWorkbench
          recipeSlug={active.recipe.slug}
          versions={options}
          selectedIds={selectedIds}
          rows={rows}
          existing={
            existing
              ? {
                  id: existing.id,
                  title: existing.title,
                  hypothesis: existing.hypothesis,
                  conclusion: existing.conclusion,
                  winningVersionId: existing.winningVersionId,
                }
              : null
          }
        />
      )}

      {saved.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
            {t('experiments.saved')}
          </h2>
          <ul className="space-y-2">
            {saved.map((experiment) => (
              <li key={experiment.id}>
                <Card>
                  <CardBody className="space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`/experiments?recipe=${experiment.recipeSlug}&versions=${experiment.versionIds.join(',')}`}
                        className="font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {experiment.title || experiment.recipeName.value}
                      </Link>
                      <span className="text-xs text-ink-faint">
                        {formatDateTime(new Date(experiment.createdAt), locale as Locale)}
                      </span>
                    </div>
                    {experiment.winningVersionId ? (
                      <Badge tone="good">{t('experiments.hasWinner')}</Badge>
                    ) : null}
                    {experiment.conclusion ? (
                      <p className="text-sm text-ink-muted">{experiment.conclusion}</p>
                    ) : null}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
