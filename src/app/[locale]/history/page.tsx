import { History } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/domain'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, EmptyState } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { getRepository } from '@/lib/data'
import { formatDateTime } from '@/lib/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'history' })
  return { title: t('title') }
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const sessions = await getRepository().listCookSessions(locale as Locale)

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">{t('history.title')}</h1>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<History className="size-6" />}
          title={t('history.empty')}
          hint={t('history.emptyHint')}
          action={
            <Link href="/recipes">
              <Button>{t('recipes.title')}</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <Card>
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/recipes/${session.recipeId}`}
                      className="font-display text-lg font-semibold text-ink underline-offset-4 hover:underline"
                    >
                      {session.recipeName.value}
                    </Link>
                    <span className="tabular text-xs text-ink-faint">
                      {formatDateTime(new Date(session.startedAt), locale)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {session.finishedAt ? (
                      <Badge tone="good">{t('cooking.complete')}</Badge>
                    ) : (
                      <Badge tone="warn">{t('cooking.resume')}</Badge>
                    )}
                    {session.rating ? (
                      <Badge tone="outline">
                        {t('history.rating')}: {session.rating}/5
                      </Badge>
                    ) : null}
                    <Badge tone="neutral">
                      {t('recipe.scale')} ×{session.scaleFactor}
                    </Badge>
                  </div>

                  {session.notes ? (
                    <p className="text-sm text-ink-muted">{session.notes}</p>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
