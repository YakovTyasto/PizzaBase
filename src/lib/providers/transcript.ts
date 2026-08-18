import 'server-only'
import { z } from 'zod'
import { serverEnv } from '@/lib/config/env'
import { formatTimecode } from '@/lib/format'
import {
  ProviderDisabledError,
  ProviderError,
  type TranscriptProvider,
  type TranscriptResult,
  type TranscriptSegment,
} from './types'

/**
 * YouTube transcripts.
 *
 * Only supported hostnames are accepted and only a normalized video ID is ever
 * sent onward, so a user-supplied URL cannot be turned into an arbitrary
 * outbound request. No attempt is made to circumvent YouTube's own access
 * controls: this calls a permitted API, and there is a manual paste path for
 * when none is configured.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
])

export class InvalidYouTubeUrlError extends Error {
  constructor() {
    super('Only youtube.com and youtu.be links are supported')
    this.name = 'InvalidYouTubeUrlError'
  }
}

/** Extracts a video ID, rejecting anything that is not a YouTube URL. */
export function parseYouTubeUrl(input: string): string {
  const trimmed = input.trim()
  // A bare ID is accepted so the manual path does not demand a full URL.
  if (VIDEO_ID.test(trimmed)) return trimmed

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new InvalidYouTubeUrlError()
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new InvalidYouTubeUrlError()
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) throw new InvalidYouTubeUrlError()

  const candidate = url.hostname.toLowerCase().endsWith('youtu.be')
    ? url.pathname.slice(1)
    : (url.searchParams.get('v') ??
      // /embed/<id>, /shorts/<id>, /live/<id>
      url.pathname.split('/').filter(Boolean).at(-1) ??
      '')

  if (!VIDEO_ID.test(candidate)) throw new InvalidYouTubeUrlError()
  return candidate
}

export function watchUrlFor(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

const supadataSchema = z.object({
  lang: z.string().optional(),
  content: z
    .array(
      z.object({
        text: z.string(),
        // Supadata reports milliseconds.
        offset: z.number(),
        duration: z.number(),
      }),
    )
    .optional(),
})

export class SupadataTranscriptProvider implements TranscriptProvider {
  get status() {
    return {
      name: 'Supadata',
      available: Boolean(serverEnv().supadataApiKey),
      requiredKey: 'SUPADATA_API_KEY',
    }
  }

  async fetchTranscript(videoId: string): Promise<TranscriptResult | null> {
    const env = serverEnv()
    if (!env.supadataApiKey) throw new ProviderDisabledError('Supadata', 'SUPADATA_API_KEY')
    if (!VIDEO_ID.test(videoId)) throw new ProviderError('Invalid video id', 'supadata')

    let response: Response
    try {
      response = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=false`,
        {
          headers: { 'x-api-key': env.supadataApiKey, accept: 'application/json' },
          signal: AbortSignal.timeout(30_000),
        },
      )
    } catch (error) {
      throw new ProviderError('Could not reach Supadata', 'supadata', error)
    }

    if (response.status === 404) return null
    if (!response.ok) {
      throw new ProviderError(`Supadata returned ${response.status}`, 'supadata')
    }

    const parsed = supadataSchema.safeParse(await response.json())
    if (!parsed.success || !parsed.data.content?.length) return null

    const segments: TranscriptSegment[] = parsed.data.content.map((segment) => ({
      text: segment.text,
      startSeconds: Math.round(segment.offset / 1000),
      endSeconds: Math.round((segment.offset + segment.duration) / 1000),
    }))

    return { segments, language: parsed.data.lang ?? null, provider: 'supadata' }
  }
}

/**
 * The always-available fallback: the user pastes the transcript themselves.
 * `fetchTranscript` returns null rather than throwing, so the import flow can
 * offer the manual box as the next step instead of showing an error.
 */
export class ManualTranscriptProvider implements TranscriptProvider {
  readonly status = { name: 'Manual', available: true }

  async fetchTranscript(): Promise<TranscriptResult | null> {
    return null
  }
}

/** Turns pasted text into one segment, since it carries no timecodes. */
export function transcriptFromText(text: string): TranscriptResult {
  return {
    segments: [{ text, startSeconds: 0, endSeconds: 0 }],
    language: null,
    provider: 'manual',
  }
}

export function transcriptToPlainText(result: TranscriptResult, maxChars = 40_000): string {
  const joined = result.segments
    .map((segment) =>
      segment.endSeconds > 0
        ? `[${formatTimecode(segment.startSeconds)}] ${segment.text}`
        : segment.text,
    )
    .join('\n')
  return joined.slice(0, maxChars)
}
