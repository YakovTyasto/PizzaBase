import 'server-only'
import { z } from 'zod'
import { serverEnv } from '@/lib/config/env'
import { ProviderDisabledError, ProviderError, type ProviderStatus } from './types'

/**
 * A thin OpenAI-compatible client.
 *
 * Uses the Responses API with structured outputs, which is the current path for
 * getting schema-conformant JSON. `OPENAI_BASE_URL` lets the same code target
 * any compatible endpoint, so switching provider is configuration rather than a
 * rewrite.
 *
 * Deliberately hand-rolled: two endpoints are needed, and an SDK would be a
 * large dependency for a small, stable surface.
 */

const RESPONSE_TIMEOUT_MS = 60_000

export function openaiStatus(name: string): ProviderStatus {
  return {
    name,
    available: Boolean(serverEnv().openaiApiKey),
    requiredKey: 'OPENAI_API_KEY',
  }
}

export interface ContentPart {
  type: 'input_text' | 'input_image'
  text?: string
  image_url?: string
}

/**
 * Converts a zod schema to the JSON Schema the API expects. Only the subset the
 * extraction schemas actually use is handled, and anything else throws rather
 * than silently producing a schema that does not match.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'output' }) as Record<
    string,
    unknown
  >
}

async function callResponses(body: Record<string, unknown>): Promise<unknown> {
  const env = serverEnv()
  if (!env.openaiApiKey) throw new ProviderDisabledError('OpenAI', 'OPENAI_API_KEY')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS)

  try {
    const response = await fetch(`${env.openaiBaseUrl}/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      // The body may carry the key back in an echoed request; only the status
      // and the provider's own message are surfaced.
      const detail = await response.text().catch(() => '')
      throw new ProviderError(
        `OpenAI request failed with ${response.status}: ${detail.slice(0, 300)}`,
        'openai',
      )
    }
    return await response.json()
  } catch (error) {
    if (error instanceof ProviderError || error instanceof ProviderDisabledError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderError('OpenAI request timed out', 'openai', error)
    }
    throw new ProviderError('OpenAI request failed', 'openai', error)
  } finally {
    clearTimeout(timeout)
  }
}

/** Pulls the text out of a Responses payload across its shape variations. */
function extractOutputText(payload: unknown): string {
  const root = payload as {
    output_text?: string | string[]
    output?: { content?: { type?: string; text?: string }[] }[]
  }

  if (typeof root.output_text === 'string' && root.output_text) return root.output_text
  if (Array.isArray(root.output_text)) return root.output_text.join('')

  const chunks: string[] = []
  for (const item of root.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === 'string') chunks.push(part.text)
    }
  }
  if (chunks.length === 0) {
    throw new ProviderError('OpenAI returned no text output', 'openai')
  }
  return chunks.join('')
}

/**
 * Requests a response that conforms to `schema` and validates it locally.
 * `strict: true` asks the API to guarantee conformance; the zod parse afterwards
 * means a provider that fails to honour that is caught rather than trusted.
 */
export async function structuredCompletion<T>(options: {
  system: string
  content: ContentPart[]
  schema: z.ZodType<T>
  schemaName: string
  maxOutputTokens?: number
}): Promise<T> {
  const env = serverEnv()

  const payload = await callResponses({
    model: env.openaiModel,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: options.system }] },
      { role: 'user', content: options.content },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: options.schemaName,
        strict: true,
        schema: toJsonSchema(options.schema),
      },
    },
    max_output_tokens: options.maxOutputTokens ?? 4000,
  })

  const raw = extractOutputText(payload)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ProviderError('OpenAI returned text that was not valid JSON', 'openai')
  }

  const result = options.schema.safeParse(parsed)
  if (!result.success) {
    throw new ProviderError(
      `OpenAI output did not match the expected schema: ${result.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
      'openai',
    )
  }
  return result.data
}

/** Plain-text completion, for translation where no structure is needed. */
export async function textCompletion(options: {
  system: string
  content: ContentPart[]
  maxOutputTokens?: number
}): Promise<string> {
  const env = serverEnv()
  const payload = await callResponses({
    model: env.openaiModel,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: options.system }] },
      { role: 'user', content: options.content },
    ],
    max_output_tokens: options.maxOutputTokens ?? 1500,
  })
  return extractOutputText(payload).trim()
}

export function imagePart(data: Uint8Array, mimeType: string): ContentPart {
  const base64 = Buffer.from(data).toString('base64')
  return { type: 'input_image', image_url: `data:${mimeType};base64,${base64}` }
}
