import { AlertTriangle, ArrowRight, CalendarClock, Sparkles } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { RecipeCard } from '@/components/recipe/recipe-card'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, EmptyState, SectionHeading } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { appConfig } from '@/lib/config/app-config'
import { getRepository } from '@/lib/data'
import { formatDateTime } from '@/lib/format'

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const repository = getRepository()

  const [recipes, plan, sessions, pantry] = await Promise.all([
    repository.listRecipes(locale as Locale),
    repository.getPlan(),
    repository.listCookSessions(locale as Locale),
    repository.getPantry(locale as Locale),
  ])

  const recipeNames = Object.fromEntries(recipes.map((r) => [r.id, r.name.value]))
  // Anything with an unknown amount or a source conflict is work the owner
  // still owes the library; surfacing it is the point of the whole review model.
  const needsReview = recipes.filter((r) => r.openQuestions > 0 || r.hasConflict).slice(0, 4)
  const unfinished = sessions.find((session) => !session.finishedAt)
  const recentlyCooked = sessions.filter((session) => session.finishedAt).slice(0, 3)

  return (
    <div className="space-y-8">
      <header>
        <p className="text-ink-faint text-sm">{appConfig.name}</p>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{t('home.greeting')}</h1>
      </header>

      {unfinished ? (
        <Card className="border-tomato">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-ink font-medium">{t('home.resumeCook')}</p>
              <p className="text-ink-muted text-sm">
                {recipeNames[unfinished.recipeId] ?? unfinished.recipeId} ·{' '}
                {t('home.resumeCookHint')}
              </p>
            </div>
            <Link href={`/recipes/${unfinished.recipeId}/cook`}>
              <Button>
                {t('cooking.resume')}
                <ArrowRight aria-hidden />
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <section>
        <SectionHeading
          action={
            <Link href="/plan" className="text-tomato text-xs underline underline-offset-2">
              {t('plan.title')}
            </Link>
          }
        >
          {t('home.nextPlan')}
        </SectionHeading>
        {plan.entries.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-6" />}
            title={t('home.noPlan')}
            action={
              <Link href="/plan">
                <Button>{t('home.planCta')}</Button>
              </Link>
            }
          />
        ) : (
          <Card>
            <CardBody className="space-y-2">
              {plan.serveAt ? (
                <p className="text-ink-muted text-sm">
                  {t('plan.serveAt')}: {formatDateTime(new Date(plan.serveAt), locale)}
                </p>
              ) : null}
              <ul className="flex flex-wrap gap-1.5">
                {plan.entries.map((entry) => (
                  <li key={entry.id}>
                    <Badge tone="accent">
                      {entry.count} × {recipeNames[entry.recipeId] ?? entry.recipeId}
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="pt-1">
                <Link href="/shopping">
                  <Button variant="outline" size="sm">
                    {t('shopping.title')}
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
      </section>

      {needsReview.length > 0 ? (
        <section>
          <SectionHeading>{t('home.needsReview')}</SectionHeading>
          <p className="text-ink-muted mb-3 flex items-start gap-1.5 text-sm">
            <AlertTriangle aria-hidden className="text-amber mt-0.5 size-4 shrink-0" />
            {t('home.needsReviewHint')}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {needsReview.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard recipe={recipe} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionHeading
          action={
            <Link
              href="/recommendations"
              className="text-tomato text-xs underline underline-offset-2"
            >
              {t('recommendations.title')}
            </Link>
          }
        >
          {t('home.recommended')}
        </SectionHeading>
        {pantry.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title={t('recommendations.empty')}
            hint={t('recommendations.emptyHint')}
            action={
              <Link href="/pantry">
                <Button variant="outline">{t('pantry.add')}</Button>
              </Link>
            }
          />
        ) : (
          <Link href="/recommendations">
            <Button variant="outline">
              <Sparkles aria-hidden />
              {t('recommendations.title')}
            </Button>
          </Link>
        )}
      </section>

      <section>
        <SectionHeading
          action={
            <Link href="/history" className="text-tomato text-xs underline underline-offset-2">
              {t('history.title')}
            </Link>
          }
        >
          {t('home.recentlyCooked')}
        </SectionHeading>
        {recentlyCooked.length === 0 ? (
          <p className="text-ink-muted text-sm">{t('home.noRecentCooks')}</p>
        ) : (
          <ul className="space-y-2">
            {recentlyCooked.map((session) => (
              <li key={session.id}>
                <Card>
                  <CardBody className="flex items-center justify-between gap-3 py-3">
                    <span className="text-ink text-sm">{session.recipeName.value}</span>
                    <span className="text-ink-faint text-xs">
                      {formatDateTime(new Date(session.startedAt), locale)}
                    </span>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
