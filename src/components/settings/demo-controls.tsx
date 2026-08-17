'use client'

import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { resetDemoDataAction, signOutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/primitives'
import { useRouter } from '@/i18n/navigation'

/**
 * Demo housekeeping.
 *
 * Reset is destructive, so it confirms first and says exactly what it removes.
 * It drops only the overlay the owner created; the bundled seed reappears
 * untouched underneath.
 */
export function DemoControls({ demoMode }: { demoMode: boolean }) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  if (!demoMode) {
    return (
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-ink-muted">{t('auth.signOut')}</span>
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

  return (
    <Card className="border-tomato">
      <CardBody className="space-y-3">
        <div>
          <p className="font-medium text-ink">{t('demo.reset')}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{t('demo.resetHint')}</p>
        </div>

        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t('demo.resetConfirm'))) return
            startTransition(async () => {
              await resetDemoDataAction()
              setDone(true)
              router.refresh()
            })
          }}
        >
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <RotateCcw aria-hidden />}
          {t('demo.reset')}
        </Button>

        {done ? (
          <p role="status" className="flex items-center gap-2 text-sm text-basil">
            <CheckCircle2 aria-hidden className="size-4" />
            {t('demo.resetDone')}
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}
