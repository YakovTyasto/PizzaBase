'use client'

import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { enterDemoAction, signInAction } from '@/app/actions/auth'
import { type DisplayError, useErrorText } from '@/components/ui/action-error'
import { Button } from '@/components/ui/button'
import { Card, CardBody, Input, Label } from '@/components/ui/primitives'
import { useRouter } from '@/i18n/navigation'

/**
 * Sign-in.
 *
 * Demo mode gets its own clearly-labelled door: no account, no database, and
 * the form says so rather than presenting a magic-link box that could not
 * possibly work.
 */
export function LoginForm({
  demoMode,
  allowlistConfigured,
  redirectTo,
}: {
  demoMode: boolean
  allowlistConfigured: boolean
  redirectTo: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<DisplayError | null>(null)
  const errorText = useErrorText()
  const [notAllowed, setNotAllowed] = useState(false)

  const submit = () => {
    setError(null)
    setNotAllowed(false)
    startTransition(async () => {
      const result = await signInAction({ email, redirectTo })
      if (result.ok) {
        setSent(true)
        return
      }
      setSent(false)
      setError(result.error)
      setNotAllowed(Boolean(result.notAllowed))
    })
  }

  const enterDemo = () => {
    startTransition(async () => {
      await enterDemoAction()
      router.push(redirectTo)
    })
  }

  return (
    <div className="space-y-4">
      {demoMode ? (
        <Card className="border-tomato">
          <CardBody className="space-y-3">
            <h2 className="font-display text-lg font-semibold">{t('auth.demoTitle')}</h2>
            <p className="text-ink-muted text-sm">{t('auth.demoHint')}</p>
            <Button onClick={enterDemo} disabled={pending}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {t('auth.demoEnter')}
              <ArrowRight aria-hidden />
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-display text-lg font-semibold">{t('auth.signIn')}</h2>

          {demoMode ? (
            <p className="bg-paper-sunken text-ink-muted flex items-start gap-2 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t('errors.providerDisabledHint', { key: 'NEXT_PUBLIC_SUPABASE_URL' })}
            </p>
          ) : null}

          {!demoMode && !allowlistConfigured ? (
            <p className="bg-amber-soft text-amber flex items-start gap-2 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t('settings.allowlistEmpty')}
            </p>
          ) : null}

          <div>
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              disabled={demoMode || pending}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && email && !demoMode) submit()
              }}
            />
          </div>

          <Button onClick={submit} disabled={demoMode || pending || !email}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Mail aria-hidden />}
            {pending ? t('auth.sending') : t('auth.sendLink')}
          </Button>

          {redirectTo !== '/' ? (
            <p className="text-ink-faint text-xs">{t('auth.returnTo', { path: redirectTo })}</p>
          ) : null}

          {sent ? (
            <p
              role="status"
              className="bg-basil-soft text-basil flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t('auth.linkSent')}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="bg-tomato-soft text-tomato-strong flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {notAllowed ? t('auth.notAllowed') : errorText(error)}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}
