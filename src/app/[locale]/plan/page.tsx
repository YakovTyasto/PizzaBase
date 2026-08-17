import { CalendarClock } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { PlanBuilder } from '@/components/plan/plan-builder'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { addToPlanAction } from '@/app/actions/plan'
import { getRepository } from '@/lib/data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'plan' })
  return { title: t('title') }
}

export default async function PlanPage({
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

  // "Add to plan" from a recipe page arrives as ?add=<slug>.
  const add = typeof query.add === 'string' ? query.add : null
  if (add) await addToPlanAction(add)

  const [plan, recipes] = await Promise.all([
    repository.getPlan(),
    repository.listRecipes(locale as Locale, { type: 'pizza' }),
  ])

  const allRecipes = await repository.listRecipes(locale as Locale)
  const namesById = Object.fromEntries(allRecipes.map((r) => [r.id, r.name.value]))

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">{t('plan.title')}</h1>

      {plan.entries.length === 0 && recipes.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-6" />}
          title={t('plan.empty')}
          hint={t('plan.emptyHint')}
          action={
            <Link href="/recipes">
              <Button>{t('recipes.title')}</Button>
            </Link>
          }
        />
      ) : (
        <PlanBuilder plan={plan} recipes={recipes} recipeNames={namesById} />
      )}
    </div>
  )
}
