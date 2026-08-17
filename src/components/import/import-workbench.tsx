'use client'

import { AlertTriangle, ExternalLink, Info, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import {
  type ImportCandidate,
  importFromTextAction,
  importFromYouTubeAction,
} from '@/app/actions/import'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Input, Label, Textarea } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { CandidateReview } from './candidate-review'

interface ProviderInfo {
  name: string
  available: boolean
  requiredKey: string | null
}

const TABS = ['youtube', 'photo', 'text', 'manual'] as const
type Tab = (typeof TABS)[number]

export function ImportWorkbench({
  initialTab,
  transcriptProvider,
  extractionProvider,
}: {
  initialTab: string
  transcriptProvider: ProviderInfo
  extractionProvider: ProviderInfo
}) {
  const t = useTranslations()
  const [tab, setTab] = useState<Tab>(
    (TABS as readonly string[]).includes(initialTab) ? (initialTab as Tab) : 'youtube',
  )
  const [pending, startTransition] = useTransition()

  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [candidate, setCandidate] = useState<ImportCandidate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needsManual, setNeedsManual] = useState(false)

  const runYouTube = () => {
    setError(null)
    setNeedsManual(false)
    startTransition(async () => {
      const result = await importFromYouTubeAction(url)
      if (result.ok) setCandidate(result.candidate)
      else {
        setError(result.error)
        setNeedsManual(Boolean(result.needsManualTranscript))
      }
    })
  }

  const runText = () => {
    setError(null)
    startTransition(async () => {
      const result = await importFromTextAction({ text, sourceUrl: url || null })
      if (result.ok) setCandidate(result.candidate)
      else setError(result.error)
    })
  }

  if (candidate) {
    return (
      <CandidateReview
        candidate={candidate}
        onDiscard={() => {
          setCandidate(null)
          setError(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="scroll-x">
        <div
          role="tablist"
          aria-label={t('import.title')}
          className="flex min-w-max gap-1 rounded-full border border-rule p-1"
        >
          {TABS.map((option) => (
            <button
              key={option}
              role="tab"
              type="button"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                tab === option ? 'bg-ink text-paper' : 'text-ink-muted hover:bg-paper-sunken',
              )}
            >
              {t(`import.${option}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Honest provider status rather than a button that silently does nothing. */}
      {!extractionProvider.available && extractionProvider.requiredKey ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('errors.providerDisabledHint', { key: extractionProvider.requiredKey })}
        </p>
      ) : null}

      {extractionProvider.name.toLowerCase().includes('mock') ? (
        <p className="flex items-start gap-2 rounded-lg bg-paper-sunken px-3 py-2 text-sm text-ink-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('errors.providerDisabled', { provider: 'OpenAI' })}{' '}
          {t('errors.providerDisabledHint', { key: 'OPENAI_API_KEY' })}
        </p>
      ) : null}

      {tab === 'youtube' ? (
        <Card>
          <CardBody className="space-y-3">
            <div>
              <Label htmlFor="yt-url">{t('import.youtubeUrl')}</Label>
              <Input
                id="yt-url"
                type="url"
                inputMode="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <p className="mt-1 text-xs text-ink-faint">{t('import.youtubeUrlHint')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={runYouTube} disabled={pending || !url}>
                {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {pending ? t('import.analyzing') : t('import.fetch')}
              </Button>
              <Badge tone={transcriptProvider.available ? 'good' : 'warn'}>
                {transcriptProvider.name}:{' '}
                {transcriptProvider.available
                  ? t('settings.providerEnabled')
                  : t('settings.providerDisabled')}
              </Badge>
            </div>

            <p className="text-xs text-ink-faint">{t('import.privacyNote')}</p>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'text' || needsManual ? (
        <Card>
          <CardBody className="space-y-3">
            <div>
              <Label htmlFor="paste-text">
                {needsManual ? t('import.transcriptManual') : t('import.pasteText')}
              </Label>
              <Textarea
                id="paste-text"
                rows={10}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t('import.pasteText')}
              />
              {needsManual ? (
                <p className="mt-1 text-xs text-ink-faint">{t('import.transcriptManualHint')}</p>
              ) : null}
            </div>
            <Button onClick={runText} disabled={pending || text.trim().length < 20}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {pending ? t('import.analyzing') : t('import.fetch')}
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'photo' ? (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm text-ink-muted">{t('import.uploadPhotoHint', { size: '8 MB' })}</p>
            <p className="flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t('errors.providerDisabledHint', { key: 'OPENAI_API_KEY' })}
            </p>
            <p className="text-xs text-ink-faint">
              <a
                href="/scan"
                className="inline-flex items-center gap-1 text-tomato underline underline-offset-2"
              >
                <ExternalLink aria-hidden className="size-3" />
                {t('scanner.title')}
              </a>
            </p>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'manual' ? (
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">{t('import.pasteText')}</p>
            <p className="mt-2 text-xs text-ink-faint">{t('import.reviewHint')}</p>
          </CardBody>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-tomato-soft px-3 py-2 text-sm text-tomato-strong">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {error}
            {needsManual ? <span className="block">{t('import.noTranscriptHint')}</span> : null}
          </span>
        </p>
      ) : null}
    </div>
  )
}
