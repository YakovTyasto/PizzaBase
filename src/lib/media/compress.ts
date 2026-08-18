'use client'

import { MAX_EDGE_PX, MAX_STORED_BYTES, MAX_UPLOAD_BYTES, type AcceptedImageType } from './types'
import { isAcceptedImageType, looksLikeHeic, sniffImageType } from './signature'

/**
 * Prepares a photo in the browser before it goes anywhere.
 *
 * Three jobs, in this order:
 *
 *  1. Decide whether this really is an image we can handle, by reading its
 *     bytes rather than trusting the file's declared type.
 *  2. Shrink it. A phone photo is 4-12 MB and a recipe never needs more than
 *     1600 px on its long edge; sending the original would waste the owner's
 *     bandwidth and, for a Vision import, their money.
 *  3. Re-encode through a canvas, which drops EXIF wholesale -- including the
 *     GPS coordinates of the kitchen it was taken in.
 *
 * Orientation is applied before the metadata is dropped, so a portrait photo
 * does not come out sideways.
 */

export class ImageRejectedError extends Error {
  readonly reason: 'too_large' | 'not_an_image' | 'heic' | 'decode_failed' | 'too_small'

  constructor(reason: ImageRejectedError['reason'], message: string) {
    super(message)
    this.name = 'ImageRejectedError'
    this.reason = reason
  }
}

export interface PreparedImage {
  blob: Blob
  type: AcceptedImageType
  width: number
  height: number
  /** Bytes before compression, so the UI can show what it saved. */
  originalBytes: number
}

const MIN_EDGE_PX = 32

export async function prepareImage(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<PreparedImage> {
  onProgress?.(0.05)

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageRejectedError('too_large', `The file is larger than ${MAX_UPLOAD_BYTES} bytes`)
  }

  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  if (looksLikeHeic(head)) {
    throw new ImageRejectedError('heic', 'HEIC is not supported')
  }

  const sniffed = sniffImageType(head)
  if (!sniffed) throw new ImageRejectedError('not_an_image', 'That file is not a JPEG, PNG or WebP')
  // A declared type that contradicts the bytes is not fatal -- the bytes win --
  // but a file claiming to be something else entirely is worth refusing.
  if (file.type && !isAcceptedImageType(file.type) && !file.type.startsWith('image/')) {
    throw new ImageRejectedError('not_an_image', 'That file is not an image')
  }

  onProgress?.(0.2)

  const bitmap = await decode(file)
  onProgress?.(0.5)

  try {
    if (bitmap.width < MIN_EDGE_PX || bitmap.height < MIN_EDGE_PX) {
      throw new ImageRejectedError('too_small', 'That image is too small to be a photo')
    }

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new ImageRejectedError('decode_failed', 'Could not process the image')
    context.drawImage(bitmap, 0, 0, width, height)

    onProgress?.(0.7)

    // A photograph compresses far better as JPEG than PNG, and the alpha
    // channel a PNG screenshot might carry is not worth the size here.
    const blob = await encodeUnder(canvas, MAX_STORED_BYTES)
    onProgress?.(1)

    return { blob, type: 'image/jpeg', width, height, originalBytes: file.size }
  } finally {
    bitmap.close?.()
  }
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // `imageOrientation: 'from-image'` applies the EXIF rotation, which is the
    // only part of the metadata worth keeping.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageRejectedError('decode_failed', 'That image could not be read')
  }
}

/** Steps the quality down until the result fits, rather than guessing once. */
async function encodeUnder(canvas: HTMLCanvasElement, limit: number): Promise<Blob> {
  for (const quality of [0.82, 0.7, 0.6, 0.5]) {
    const blob = await toBlob(canvas, quality)
    if (blob.size <= limit) return blob
  }
  return toBlob(canvas, 0.4)
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new ImageRejectedError('decode_failed', 'Could not encode the image'))
      },
      'image/jpeg',
      quality,
    )
  })
}
