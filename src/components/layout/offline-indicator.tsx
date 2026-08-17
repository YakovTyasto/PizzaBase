'use client'

import { CloudOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useOffline } from '@/lib/client-env'

/**
 * Shows connection state so the user knows why a write might fail. Optimistic
 * on first paint: `navigator.onLine` is unavailable during SSR, and flashing
 * "offline" on every load would be worse than a moment of silence.
 */
export function OfflineIndicator() {
  const t = useTranslations('common')
  const offline = useOffline()

  if (!offline) return null

  return (
    <div
      role="status"
      className="flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-xs font-medium text-amber"
    >
      <CloudOff aria-hidden className="size-3.5" />
      {t('offline')}
    </div>
  )
}
