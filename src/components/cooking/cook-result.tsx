'use client'

import { AlertTriangle, Check, CloudUpload, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { saveCookResultAction } from '@/app/actions/cook'
import { uploadMediaAction } from '@/app/actions/media'
import { MediaImage } from '@/components/media/media-image'
import { Button } from '@/components/ui/button'
import { Card, CardBody, Input, Label, Textarea } from '@/components/ui/primitives'
import { useOffline } from '@/lib/client-env'
import { ImageRejectedError, prepareImage } from '@/lib/media/compress'
import { deleteBlob, putBlob } from '@/lib/media/idb'
import { enqueue } from '@/lib/offline/queue'
import { cn } from '@/lib/utils'

interface Photo {
  id: string
  storagePath: string | null
  alt: string
}

/**
 * What happened, recorded while it is still fresh.
 *
 * This is the screen the whole versioning story pays off on: the session
 * points at the exact immutable version and scale that were cooked, so a
 * result stays meaningful after the recipe moves on. Saving works offline
 * through the same queue as a recipe draft, and says which it did.
 */
export function CookResult({
  recipeId,
  recipeSlug,
  versionId,
  scaleFactor,
  startedAt,
  completedStepIds,
  plannedActiveMinutes,
  plannedPassiveMinutes,
  onSaved,
}: {
  recipeId: string
  recipeSlug: string
  versionId: string | null
  scaleFactor: string
  startedAt: string
  completedStepIds: string[]
  plannedActiveMinutes: number | null
  plannedPassiveMinutes: number | null
  onSaved?: () => void
}) {
  const t = useTranslations()
  const offline = useOffline()
  const [pending, startTransition] = useTransition()

  const [rating, setRating] = useState<number | null>(null)
  const [taste, setTaste] = useState<number | null>(null)
  const [crust, setCrust] = useState<number | null>(null)
  const [handling, setHandling] = useState<number | null>(null)
  const [activeMinutes, setActiveMinutes] = useState(
    plannedActiveMinutes ? String(plannedActiveMinutes) : '',
  )
  const [passiveMinutes, setPassiveMinutes] = useState(
    plannedPassiveMinutes ? String(plannedPassiveMinutes) : '',
  )
  const [notes, setNotes] = useState('')
  const [nextTime, setNextTime] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)

  const [saved, setSaved] = useState(false)
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addPhoto = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const prepared = await prepareImage(file)
      const id = crypto.randomUUID()
      await putBlob(id, prepared.blob)

      const uploaded = await uploadMediaAction({
        id,
        bytes: await prepared.blob.arrayBuffer(),
        contentType: prepared.type,
      })
      if (!uploaded.ok) {
        await deleteBlob(id)
        setError(uploaded.error)
        return
      }
      setPhotos((current) => [...current, { id, storagePath: uploaded.storagePath, alt: '' }])
    } catch (cause) {
      setError(
        cause instanceof ImageRejectedError
          ? t(`media.reject.${cause.reason}`)
          : t('errors.generic'),
      )
    } finally {
      setUploading(false)
    }
  }

  const payload = () => ({
    // Stable across retries: one cook of one recipe started at one moment.
    id: `cook-${recipeId}-${startedAt}`,
    recipeId,
    recipeSlug,
    versionId,
    scaleFactor,
    startedAt,
    finishedAt: new Date().toISOString(),
    rating,
    tasteRating: taste,
    crustRating: crust,
    handlingRating: handling,
    actualActiveMinutes: activeMinutes ? Number(activeMinutes) : null,
    actualPassiveMinutes: passiveMinutes ? Number(passiveMinutes) : null,
    notes: notes.trim() || null,
    nextTime: nextTime.trim() || null,
    completedStepIds,
    media: photos,
  })

  const save = () => {
    setError(null)
    startTransition(async () => {
      const body = payload()
      try {
        const result = await saveCookResultAction(body)
        if (result.ok) {
          setSaved(true)
          setQueued(false)
          onSaved?.()
          return
        }
        setSaved(false)
        setError(result.error)
      } catch (cause) {
        // Cooking progress is one of the two things safe to replay, and this
        // is the moment it matters most: nobody wants to retype how it went.
        if (offline || cause instanceof TypeError) {
          enqueue('cook-session', body.id, body)
          setQueued(true)
          onSaved?.()
          return
        }
        setError(cause instanceof Error ? cause.message : t('errors.generic'))
      }
    })
  }

  if (saved || queued) {
    return (
      <Card className={queued ? 'border-amber' : 'border-basil'}>
        <CardBody className="flex items-start gap-2">
          {queued ? (
            <CloudUpload aria-hidden className="mt-0.5 size-4 text-amber" />
          ) : (
            <Check aria-hidden className="mt-0.5 size-4 text-basil" />
          )}
          <p className={queued ? 'text-sm text-amber' : 'text-sm text-basil'}>
            {queued ? t('sync.offlineSaved') : t('cooking.resultSaved')}
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{t('cooking.resultTitle')}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{t('cooking.resultHint')}</p>
        </div>

        <Stars label={t('cooking.overall')} value={rating} onChange={setRating} />
        <Stars label={t('cooking.taste')} value={taste} onChange={setTaste} />
        <Stars label={t('cooking.crust')} value={crust} onChange={setCrust} />
        <Stars label={t('cooking.handling')} value={handling} onChange={setHandling} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="actual-active">{t('cooking.actualActive')}</Label>
            <Input
              id="actual-active"
              inputMode="numeric"
              value={activeMinutes}
              onChange={(event) => setActiveMinutes(event.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <Label htmlFor="actual-passive">{t('cooking.actualPassive')}</Label>
            <Input
              id="actual-passive"
              inputMode="numeric"
              value={passiveMinutes}
              onChange={(event) => setPassiveMinutes(event.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="cook-notes">{t('cooking.resultNotes')}</Label>
          <Textarea
            id="cook-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="next-time">{t('cooking.nextTime')}</Label>
          <Textarea
            id="next-time"
            rows={2}
            placeholder={t('cooking.nextTimeHint')}
            value={nextTime}
            onChange={(event) => setNextTime(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cook-photo">{t('cooking.resultPhotos')}</Label>
          <input
            id="cook-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void addPhoto(file)
            }}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-paper-sunken file:px-3 file:py-1.5 file:text-sm"
          />
          {uploading ? (
            <p className="flex items-center gap-2 text-xs text-ink-faint">
              <Loader2 aria-hidden className="size-3 animate-spin" />
              {t('media.processing')}
            </p>
          ) : null}

          {photos.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <MediaImage
                    id={photo.id}
                    url={null}
                    alt={null}
                    className="size-20 rounded-lg"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-tomato-soft px-3 py-2 text-sm text-tomato-strong"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button onClick={save} disabled={pending || uploading}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
          {t('cooking.saveResult')}
        </Button>
      </CardBody>
    </Card>
  )
}

/** A 1-5 scale. Left unset unless the cook actually rates it. */
function Stars({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (next: number | null) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex gap-1" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            aria-label={`${label}: ${score}`}
            aria-pressed={value === score}
            onClick={() => onChange(value === score ? null : score)}
            className={cn(
              'size-9 rounded-full border text-sm tabular-nums',
              value !== null && score <= value
                ? 'border-tomato bg-tomato-soft text-tomato-strong'
                : 'border-rule text-ink-muted',
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )
}
