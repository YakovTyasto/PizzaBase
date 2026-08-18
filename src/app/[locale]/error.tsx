'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/primitives'

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations()

  useEffect(() => {
    // The digest is what ties this screen to a server log line; the message
    // itself may contain details that should not be rendered.
    console.error('Unhandled error', error.digest ?? error.message)
  }, [error])

  return (
    <div className="py-10">
      <Card className="border-tomato">
        <CardBody className="space-y-3">
          <p className="text-tomato-strong flex items-center gap-2 font-medium">
            <AlertTriangle aria-hidden className="size-5" />
            {t('errors.generic')}
          </p>
          {error.digest ? <p className="tabular text-ink-faint text-xs">{error.digest}</p> : null}
          <Button onClick={reset}>{t('common.retry')}</Button>
        </CardBody>
      </Card>
    </div>
  )
}
