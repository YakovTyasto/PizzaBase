import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LoginForm } from '@/components/auth/login-form'
import { appConfig } from '@/lib/config/app-config'
import { configReport, isDemoMode } from '@/lib/config/env'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { title: t('signInTitle') }
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  const query = await searchParams
  const next = typeof query.next === 'string' && query.next.startsWith('/') ? query.next : '/'

  const demo = isDemoMode()
  const report = configReport()

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="font-display text-3xl font-semibold">{appConfig.name}</h1>
      <p className="text-ink-muted mt-1 text-sm">{t('auth.signInHint')}</p>

      <div className="mt-6">
        <LoginForm
          demoMode={demo}
          allowlistConfigured={report.allowlistConfigured}
          redirectTo={next}
        />
      </div>
    </div>
  )
}
