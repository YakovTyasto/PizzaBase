import { History } from 'lucide-react'
import { MediaStrip } from '@/components/media/media-strip'
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
                    {session.versionNumber !== null ? (
                      <Link href={`/recipes/${session.recipeId}/versions`}>
                        <Badge tone="accent">
                          {t('cooking.usedVersion', { number: session.versionNumber })}
                        </Badge>
                      </Link>
                    ) : null}
                  </div>

                  {/* The scores that were actually given, in the order the
                      result screen asks for them. */}
                  {session.tasteRating || session.crustRating || session.handlingRating ? (
                    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      {(
                        [
                          ['taste', session.tasteRating],
                          ['crust', session.crustRating],
                          ['handling', session.handlingRating],
                        ] as const
                      ).map(([key, score]) =>
                        score ? (
                          <div key={key} className="flex gap-1">
                            <dt>{t(`cooking.${key}`)}:</dt>
                            <dd className="tabular font-medium text-ink">{score}/5</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  ) : null}

                  {session.actualActiveMinutes !== null ||
                  session.actualPassiveMinutes !== null ? (
                    <p className="tabular text-xs text-ink-faint">
                      {session.actualActiveMinutes !== null
                        ? `${t('cooking.activeWork')}: ${session.actualActiveMinutes}′`
                        : ''}
                      {session.actualPassiveMinutes !== null
                        ? ` · ${t('cooking.waiting')}: ${session.actualPassiveMinutes}′`
                        : ''}
                    </p>
                  ) : null}

                  {session.media.length > 0 ? (
                    <MediaStrip media={session.media} label={t('media.photos')} />
                  ) : null}

                  {session.notes ? (
                    <p className="text-sm text-ink-muted">{session.notes}</p>
                  ) : null}

                  {session.nextTime ? (
                    <p className="rounded-lg bg-paper-sunken px-3 py-2 text-sm text-ink">
                      <span className="text-xs text-ink-faint">{t('cooking.nextTime')}: </span>
                      {session.nextTime}
                    </p>
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
