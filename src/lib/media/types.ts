import type { Locale } from '@/domain'

/**
 * A photo attached to a recipe or a cook session.
 *
 * The bytes live in one of two places depending on how the app is configured,
 * and the difference is deliberately visible in the type: `url` is a
 * short-lived signed URL when a private Supabase bucket is holding the file,
 * and `null` in demo mode, where the bytes are in the browser's own IndexedDB
 * and only the client can resolve them.
 */
export interface MediaView {
  id: string
  url: string | null
  alt: string | null
  isCover: boolean
}

export interface MediaDraft {
  /** Stable id, minted by the client, used as the IndexedDB key in demo mode. */
  id: string
  /** Object path inside the private bucket; null when the bytes are local. */
  storagePath: string | null
  alt: Record<Locale, string>
  isCover: boolean
}

/** Formats a browser can decode everywhere the app runs. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number]

/** Formats we knowingly cannot decode, so the message can name them. */
export const KNOWN_UNSUPPORTED_TYPES = ['image/heic', 'image/heif', 'image/avif'] as const

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
/** After compression. A recipe photo has no business being larger. */
export const MAX_STORED_BYTES = 1.5 * 1024 * 1024
export const MAX_EDGE_PX = 1600
export const MAX_MEDIA_PER_RECIPE = 12
