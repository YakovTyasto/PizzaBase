import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar'
import { routing } from '@/i18n/routing'
import { appConfig } from '@/lib/config/app-config'
import '../globals.css'

/** Pre-renders all three locales rather than resolving them per request. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: appConfig.backgroundColor },
    { media: '(prefers-color-scheme: dark)', color: appConfig.themeColor },
  ],
  width: 'device-width',
  initialScale: 1,
  // Allow zoom: pinching a recipe is a legitimate accessibility need.
  maximumScale: 5,
  viewportFit: 'cover',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'app' })

  return {
    title: { default: appConfig.name, template: `%s · ${appConfig.name}` },
    description: t('tagline'),
    applicationName: appConfig.name,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: appConfig.shortName, statusBarStyle: 'default' },
    formatDetection: { telephone: false },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  // Required for static rendering of a locale-segmented App Router tree.
  setRequestLocale(locale)

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <AppShell>{children}</AppShell>
          <ServiceWorkerRegistrar />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
