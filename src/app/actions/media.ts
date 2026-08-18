'use server'

import { z } from 'zod'
import { getRepository } from '@/lib/data'
import type { ActionError } from '@/lib/data/errors'
import { toActionError } from '@/lib/data/failure'
import { sniffImageType } from '@/lib/media/signature'
import { MAX_STORED_BYTES } from '@/lib/media/types'

/**
 * Accepts one already-prepared image.
 *
 * The browser resized and re-encoded it, but a Server Action is a public
 * endpoint: the size and the actual bytes are checked again here, because the
 * client-side pipeline is a convenience for the user, not a guarantee to the
 * server. A file whose contents are not a JPEG, PNG or WebP is refused
 * whatever it claims to be.
 */

const uploadSchema = z.object({
  id: z.string().trim().min(1).max(100),
  bytes: z.instanceof(ArrayBuffer),
  contentType: z.string().trim().max(100),
})

export type UploadMediaResult =
  { ok: true; storagePath: string | null } | { ok: false; error: ActionError }

export async function uploadMediaAction(input: unknown): Promise<UploadMediaResult> {
  const parsed = uploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: { code: 'validation' } }

  const { id, bytes } = parsed.data

  if (bytes.byteLength === 0) return { ok: false, error: { code: 'validation' } }
  if (bytes.byteLength > MAX_STORED_BYTES) {
    return { ok: false, error: { code: 'validation' } }
  }

  const sniffed = sniffImageType(new Uint8Array(bytes.slice(0, 32)))
  if (!sniffed) return { ok: false, error: { code: 'validation' } }

  // The sniffed type wins over whatever the client declared: it is the one
  // fact about the file that cannot be spoofed by renaming it.
  // An id that could escape its folder must never reach a storage path.
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) return { ok: false, error: { code: 'validation' } }

  try {
    const result = await getRepository().uploadMedia({ id, bytes, contentType: sniffed })
    return { ok: true, storagePath: result.storagePath }
  } catch (error) {
    return { ok: false, error: toActionError(error, 'uploadMedia') }
  }
}
