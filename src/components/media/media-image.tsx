'use client'

import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { blobUrl } from '@/lib/media/idb'
import { cn } from '@/lib/utils'

/**
 * Renders one photo, wherever its bytes happen to live.
 *
 * With Supabase configured the server hands down a short-lived signed URL and
 * this is an ordinary image. In demo mode there is no server-side file at all,
 * so `url` is null and the bytes come out of the browser's own IndexedDB. One
 * component covers both because every screen that shows a photo would
 * otherwise need to know which backend it is talking to.
 */
export function MediaImage({
  id,
  url,
  alt,
  className,
  sizes,
  priority,
}: {
  id: string
  url: string | null
  alt: string | null
  className?: string
  sizes?: string
  priority?: boolean
}) {
  // Only the local lookup needs state; a server-provided URL is already the
  // answer and setting it from an effect would just cause a second render.
  const [local, setLocal] = useState<{ id: string; url: string | null } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (url) return
    let cancelled = false
    void blobUrl(id).then((found) => {
      if (!cancelled) setLocal({ id, url: found })
    })
    return () => {
      cancelled = true
    }
  }, [id, url])

  const resolved = url ?? (local?.id === id ? local.url : null)
  const missing = !url && local?.id === id && local.url === null

  if (failed || missing) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-paper-sunken text-ink-faint',
          className,
        )}
        aria-hidden
      >
        <ImageOff className="size-5" />
      </div>
    )
  }

  if (!resolved) {
    // Reserve the space rather than collapsing the layout while the blob loads.
    return <div className={cn('animate-pulse bg-paper-sunken', className)} aria-hidden />
  }

  return (
    /* A signed URL or a blob: URL -- next/image can optimise neither, and
       routing a private photo through the optimiser would cache it. */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={resolved}
      alt={alt ?? ''}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('object-cover', className)}
      onError={() => setFailed(true)}
    />
  )
}
