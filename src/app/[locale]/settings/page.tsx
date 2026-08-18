import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'
import { DemoControls } from '@/components/settings/demo-controls'
import { Badge, Card, CardBody, DataRow, SectionHeading } from '@/components/ui/primitives'
import { appConfig } from '@/lib/config/app-config'
import { configReport, validateStartup } from '@/lib/config/env'
import { getRepository } from '@/lib/data'
import { providerStatuses } from '@/lib/providers/registry'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'settings' })
  return { title: t('title') }
}

/**
 * Settings doubles as the honest status page: it names every provider, says
 * whether it is live, and gives the exact environment variable that would turn
 * a disabled one on.
 */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const report = configReport()
  const problems = validateStartup()
  const statuses = providerStatuses()
  const repository = getRepository()
  const settings = await repository.getSettings()

  const providers = [
    { key: 'productLookup', status: statuses.productLookup },
    { key: 'transcript', status: statuses.transcript },
    { key: 'vision', status: statuses.vision },
    { key: 'extraction', status: statuses.extraction },
    { key: 'translation', status: statuses.translation },
    { key: 'narration', status: statuses.narration },
  ]

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t('settings.title')}</h1>

      <section>
        <SectionHeading>{t('settings.language')}</SectionHeading>
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-ink-muted text-sm">{t('settings.language')}</span>
            <LocaleSwitcher />
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeading>{t('settings.defaults')}</SectionHeading>
        <Card>
          <CardBody>
            <dl>
              <DataRow label={t('settings.appName')}>{appConfig.name}</DataRow>
              <DataRow label={t('settings.defaultDiameter')}>
                {settings.defaultDiameterMm} mm
              </DataRow>
              <DataRow label={t('settings.defaultBallWeight')}>
                {settings.defaultBallWeightG} g
              </DataRow>
              <DataRow label={t('settings.temperature')}>
                {settings.temperatureUnit === 'c'
                  ? t('settings.celsius')
                  : t('settings.fahrenheit')}
              </DataRow>
              <DataRow label={t('recommendations.includeExperimental')}>
                {settings.includeExperimental ? t('common.yes') : t('common.no')}
              </DataRow>
            </dl>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeading>{t('settings.integrations')}</SectionHeading>
        <Card>
          <CardBody>
            <ul className="divide-rule divide-y">
              {providers.map(({ key, status }) => (
                <li key={key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">{status.name}</p>
                    {!status.available && status.requiredKey ? (
                      <p className="text-ink-faint text-xs">
                        {t('settings.providerMissingKey', { key: status.requiredKey })}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={status.available ? 'good' : 'warn'}>
                    {status.available ? (
                      <CheckCircle2 aria-hidden className="size-3" />
                    ) : (
                      <XCircle aria-hidden className="size-3" />
                    )}
                    {status.available
                      ? t('settings.providerEnabled')
                      : t('settings.providerDisabled')}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeading>{t('settings.allowlist')}</SectionHeading>
        <Card>
          <CardBody>
            <dl>
              <DataRow label={t('settings.demoMode')}>
                {report.demoMode ? t('common.yes') : t('common.no')}
              </DataRow>
              {/* The one line that answers "will anything I do here survive?" */}
              <DataRow label={t('settings.storage')}>
                {report.storageMode === 'supabase'
                  ? t('settings.storageSupabase')
                  : report.storageMode === 'demo'
                    ? t('settings.storageDemo')
                    : t('settings.storageReadOnly')}
              </DataRow>
              <DataRow label="Supabase">
                {report.supabase ? t('settings.providerEnabled') : t('settings.providerDisabled')}
              </DataRow>
              <DataRow label={t('settings.allowlist')}>
                {report.allowlistConfigured
                  ? t('settings.allowlistConfigured')
                  : t('settings.allowlistEmpty')}
              </DataRow>
            </dl>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionHeading>
          {report.demoMode ? t('settings.demoMode') : t('auth.signIn')}
        </SectionHeading>
        <DemoControls demoMode={report.demoMode} writable={report.writable} />
      </section>

      {/* Startup problems, which are a stronger statement than a warning: a
          configuration that is not merely incomplete but incoherent. */}
      {problems.length > 0 ? (
        <section>
          <SectionHeading>{t('settings.startupProblems')}</SectionHeading>
          <ul className="space-y-2">
            {problems.map((problem) => (
              <li
                key={problem.variable}
                className={
                  problem.severity === 'error'
                    ? 'bg-tomato-soft text-tomato-strong flex items-start gap-2 rounded-lg px-3 py-2 text-sm'
                    : 'bg-amber-soft text-amber flex items-start gap-2 rounded-lg px-3 py-2 text-sm'
                }
              >
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  <code className="font-medium">{problem.variable}</code> — {problem.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.warnings.length > 0 ? (
        <section>
          <SectionHeading>{t('settings.warnings')}</SectionHeading>
          <ul className="space-y-2">
            {report.warnings.map((warning) => (
              <li
                key={warning}
                className="bg-amber-soft text-amber flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                {warning}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
