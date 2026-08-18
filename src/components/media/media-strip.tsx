'use client'

import { useState } from 'react'
import type { MediaView } from '@/lib/media/types'
import { cn } from '@/lib/utils'
import { MediaImage } from './media-image'

/**
 * The photos on a recipe or a finished cook.
 *
 * One large photo with thumbnails beneath, rather than a grid: on a phone
 * held over a worktop a single big picture is what is actually useful, and
 * the thumbnails scroll sideways in their own container so a long strip never
 * widens the page.
 */
export function MediaStrip({ media, label }: { media: MediaView[]; label: string }) {
  const initial = media.findIndex((photo) => photo.isCover)
  const [active, setActive] = useState(initial >= 0 ? initial : 0)

  if (media.length === 0) return null
  const current = media[Math.min(active, media.length - 1)]!

  return (
    <figure className="space-y-2">
      <MediaImage
        id={current.id}
        url={current.url}
        alt={current.alt}
        priority
        sizes="(max-width: 1024px) 100vw, 640px"
        className="aspect-[4/3] w-full rounded-[var(--radius-card)]"
      />

      {current.alt ? (
        <figcaption className="text-ink-faint text-xs">{current.alt}</figcaption>
      ) : null}

      {media.length > 1 ? (
        <div className="scroll-x" role="group" aria-label={label}>
          <div className="flex w-max gap-2">
            {media.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                aria-current={index === active}
                onClick={() => setActive(index)}
                className={cn(
                  'size-16 shrink-0 overflow-hidden rounded-lg border-2',
                  index === active ? 'border-tomato' : 'border-transparent',
                )}
              >
                <MediaImage id={photo.id} url={photo.url} alt={photo.alt} className="size-full" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </figure>
  )
}
