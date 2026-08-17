'use client'

import { CloudOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

/**
 * Shows connection state so the user knows why a write might be queued. Starts
 * optimistic: `navigator.onLine` is unavailable during SSR, and flashing
 * "offline" on every first paint would be worse than a moment of silence.
 */
export function OfflineIndicator() {
  const t = useTranslations('common')
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

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
