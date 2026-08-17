import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ImportWorkbench } from '@/components/import/import-workbench'
import { providerStatuses } from '@/lib/providers/registry'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'import' })
  return { title: t('title') }
}

export default async function ImportPage({
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
  const tab = typeof query.tab === 'string' ? query.tab : 'youtube'

  // The screen tells the user exactly which provider is live, so a mocked
  // extraction is never mistaken for a real one.
  const statuses = providerStatuses()

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold">{t('import.title')}</h1>
      <ImportWorkbench
        initialTab={tab}
        transcriptProvider={{
          name: statuses.transcript.name,
          available: statuses.transcript.available,
          requiredKey: statuses.transcript.requiredKey ?? null,
        }}
        extractionProvider={{
          name: statuses.extraction.name,
          available: statuses.extraction.available,
          requiredKey: statuses.extraction.requiredKey ?? null,
        }}
      />
    </div>
  )
}
