'use client'

import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { resetDemoDataAction, signOutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/primitives'
import { useRouter } from '@/i18n/navigation'
import { clearBlobs } from '@/lib/media/idb'

/**
 * Demo housekeeping.
 *
 * Reset is destructive, so it confirms first and says exactly what it removes.
 * It drops only the overlay the owner created; the bundled seed reappears
 * untouched underneath.
 */
export function DemoControls({
  demoMode,
  writable,
}: {
  demoMode: boolean
  /** False on a read-only demo: there is nothing stored, so nothing to reset. */
  writable: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  if (!demoMode) {
    return (
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-ink-muted text-sm">{t('auth.signOut')}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await signOutAction()
                router.push('/login')
              })
            }
          >
            {t('auth.signOut')}
          </Button>
        </CardBody>
      </Card>
    )
  }

  if (!writable) {
    return (
      <Card className="border-amber">
        <CardBody className="space-y-1">
          <p className="text-ink font-medium">{t('demo.readOnly')}</p>
          <p className="text-ink-muted text-sm">{t('demo.readOnlyHint')}</p>
          <p className="text-ink-faint text-sm">{t('demo.readOnlyFix')}</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="border-tomato">
      <CardBody className="space-y-3">
        <div>
          <p className="text-ink font-medium">{t('demo.reset')}</p>
          <p className="text-ink-muted mt-0.5 text-sm">{t('demo.resetHint')}</p>
        </div>

        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t('demo.resetConfirm'))) return
            startTransition(async () => {
              await resetDemoDataAction()
              // The photos live in this browser's IndexedDB, which the server
              // cannot reach. Resetting has to clear them here or the bytes
              // would outlive every recipe that referred to them.
              await clearBlobs()
              setDone(true)
              router.refresh()
            })
          }}
        >
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <RotateCcw aria-hidden />}
          {t('demo.reset')}
        </Button>

        {done ? (
          <p role="status" className="text-basil flex items-center gap-2 text-sm">
            <CheckCircle2 aria-hidden className="size-4" />
            {t('demo.resetDone')}
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}
