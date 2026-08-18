import { CloudOff } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { EmptyState } from '@/components/ui/primitives'

/**
 * The page the service worker serves when a navigation fails with no cached
 * copy available. Kept static so it can itself be cached at install time.
 */
export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations()
  return (
    <div className="py-10">
      <EmptyState
        icon={<CloudOff className="size-6" />}
        title={t('offline.title')}
        hint={t('offline.hint')}
      />
    </div>
  )
}
