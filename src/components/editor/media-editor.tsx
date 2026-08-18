'use client'

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { uploadMediaAction } from '@/app/actions/media'
import { MediaImage } from '@/components/media/media-image'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/primitives'
import { ImageRejectedError, prepareImage } from '@/lib/media/compress'
import { deleteBlob, forgetBlobUrl, putBlob } from '@/lib/media/idb'
import type { RecipeDraft } from '@/lib/data/recipe-draft'
import { MAX_MEDIA_PER_RECIPE } from '@/lib/media/types'
import { cn } from '@/lib/utils'

type DraftMedia = RecipeDraft['media'][number]

/**
 * The photo strip in the recipe editor.
 *
 * Every file is shrunk and re-encoded in the browser before it goes anywhere,
 * which strips EXIF -- including where the photo was taken -- and keeps a 12 MB
 * phone picture from becoming a 12 MB upload. Only then does it reach the
 * server, and in demo mode it never leaves the device at all.
 */
export function MediaEditor({
  media,
  onChange,
  locale,
}: {
  media: DraftMedia[]
  onChange: (next: DraftMedia[]) => void
  locale: 'ru' | 'en' | 'fr'
}) {
  const t = useTranslations()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const atLimit = media.length >= MAX_MEDIA_PER_RECIPE

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)

    const room = MAX_MEDIA_PER_RECIPE - media.length
    const chosen = Array.from(files).slice(0, Math.max(0, room))
    if (chosen.length === 0) return

    startTransition(async () => {
      const added: DraftMedia[] = []

      for (const [index, file] of chosen.entries()) {
        try {
          const prepared = await prepareImage(file, (fraction) => {
            setProgress((index + fraction) / chosen.length)
          })

          const id = crypto.randomUUID()
          // Keep a local copy either way: it is what the editor renders, and
          // in demo mode it is the only copy there is.
          await putBlob(id, prepared.blob)

          const uploaded = await uploadMediaAction({
            id,
            bytes: await prepared.blob.arrayBuffer(),
            contentType: prepared.type,
          })
          if (!uploaded.ok) {
            // The bytes are still on the device, so nothing is lost; the photo
            // simply is not added and the reason is shown.
            await deleteBlob(id)
            setError(uploaded.error)
            continue
          }

          added.push({
            id,
            storagePath: uploaded.storagePath,
            url: null,
            alt: { ru: '', en: '', fr: '' },
            isCover: media.length === 0 && added.length === 0,
          })
        } catch (cause) {
          setError(
            cause instanceof ImageRejectedError
              ? t(`media.reject.${cause.reason}`)
              : t('errors.generic'),
          )
        }
      }

      setProgress(null)
      if (added.length > 0) onChange([...media, ...added])
    })
  }

  const update = (index: number, patch: Partial<DraftMedia>) => {
    onChange(media.map((photo, i) => (i === index ? { ...photo, ...patch } : photo)))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= media.length) return
    const next = [...media]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    onChange(next)
  }

  const remove = (index: number) => {
    const photo = media[index]
    if (!photo) return
    void deleteBlob(photo.id)
    forgetBlobUrl(photo.id)

    const next = media.filter((_, i) => i !== index)
    // The cover cannot simply vanish; the first remaining photo takes over.
    if (photo.isCover && next.length > 0 && !next.some((p) => p.isCover)) {
      next[0] = { ...next[0]!, isCover: true }
    }
    onChange(next)
  }

  const setCover = (index: number) => {
    onChange(media.map((photo, i) => ({ ...photo, isCover: i === index })))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          aria-label={t('media.add')}
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <ImagePlus aria-hidden />}
          {t('media.add')}
        </Button>
        <span className="text-xs text-ink-faint">
          {t('media.limit', { count: MAX_MEDIA_PER_RECIPE })}
        </span>
      </div>

      {progress !== null ? (
        <div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-paper-sunken"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={t('media.processing')}
          >
            <div
              className="h-full bg-tomato transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-ink-faint">{t('media.processing')}</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-tomato-soft px-3 py-2 text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}

      {media.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('media.none')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {media.map((photo, index) => (
            <li
              key={photo.id}
              className={cn(
                'overflow-hidden rounded-[var(--radius-card)] border',
                photo.isCover ? 'border-tomato' : 'border-rule',
              )}
            >
              <MediaImage
                id={photo.id}
                url={photo.url}
                alt={photo.alt[locale] || null}
                className="aspect-[4/3] w-full"
              />
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant={photo.isCover ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setCover(index)}
                    aria-pressed={photo.isCover}
                  >
                    <Star aria-hidden />
                    {t('media.cover')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('editor.moveUp')}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('editor.moveDown')}
                    disabled={index === media.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('common.delete')}
                    onClick={() => remove(index)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>

                <div>
                  <Label htmlFor={`alt-${photo.id}`}>{t('media.alt')}</Label>
                  <Input
                    id={`alt-${photo.id}`}
                    value={photo.alt[locale]}
                    placeholder={t('media.altHint')}
                    onChange={(event) =>
                      update(index, { alt: { ...photo.alt, [locale]: event.target.value } })
                    }
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
