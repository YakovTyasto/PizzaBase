'use client'

import { Bell, BellOff, Check, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import {
  type PermissionState,
  canDeliverInBackground,
  notificationSupport,
  requestPermission,
} from '@/lib/notify/local'

/**
 * Asking for notification permission, once, with a reason.
 *
 * The prompt is behind a button because an unexplained permission dialog on
 * page load is both rude and, in several browsers, ignored. The copy says what
 * the app will actually do -- notify while it is open -- and separately says
 * when the platform cannot manage more than that, rather than implying
 * background delivery it cannot guarantee.
 */
const subscribeNever = () => () => {}

export function NotificationOptIn({ compact = false }: { compact?: boolean }) {
  const t = useTranslations()
  const [state, setState] = useState<PermissionState | null>(null)

  // Read through the store hook so the server render and hydration agree.
  const initial = useSyncExternalStore(
    subscribeNever,
    notificationSupport,
    () => 'default' as PermissionState,
  )
  const background = useSyncExternalStore(subscribeNever, canDeliverInBackground, () => false)

  const permission = state ?? initial

  const ask = useCallback(() => {
    void requestPermission().then(setState)
  }, [])

  if (permission === 'unsupported') {
    return (
      <p className="flex items-start gap-2 text-xs text-ink-faint">
        <BellOff aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {t('notify.unsupported')}
      </p>
    )
  }

  if (permission === 'granted') {
    return (
      <p className="flex items-start gap-2 text-xs text-basil">
        <Check aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {background ? t('notify.granted') : t('notify.grantedForeground')}
      </p>
    )
  }

  if (permission === 'denied') {
    return (
      <p className="flex items-start gap-2 text-xs text-ink-faint">
        <BellOff aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {t('notify.denied')}
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {!compact ? (
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('notify.why')}
        </p>
      ) : null}
      <Button variant="outline" size="sm" onClick={ask}>
        <Bell aria-hidden />
        {t('notify.enable')}
      </Button>
      <p className="text-xs text-ink-faint">
        {background ? t('notify.scopeBackground') : t('notify.scopeForeground')}
      </p>
    </div>
  )
}
