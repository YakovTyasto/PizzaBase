import 'server-only'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { SeedRecipe } from '@/lib/seed/types'

/**
 * Durable demo-mode storage.
 *
 * The seed catalog stays the read-only base; everything the owner changes is
 * an *overlay* on top of it. A recipe they edit is copied into the overlay and
 * shadows its seed original, so "reset demo data" is simply discarding the
 * overlay -- the seed is never mutated.
 *
 * The overlay lives on disk keyed by a small session id, which is the only
 * thing in the cookie. An earlier version stored the whole catalog in the
 * cookie itself; that hit the 4 KB browser limit the moment a recipe was
 * edited, so the data moved server-side and the cookie kept just the key.
 *
 * Writes are atomic (write to a temp file, then rename) so a crash mid-save
 * cannot leave a half-written overlay behind.
 */

const DATA_DIR =
  process.env.IMPASTO_DEMO_DIR ?? path.join(process.cwd(), '.impasto-demo')

const amountSchema = z.union([
  z.object({ kind: z.literal('exact'), value: z.string(), unit: z.string() }),
  z.object({ kind: z.literal('range'), min: z.string(), max: z.string(), unit: z.string() }),
  z.object({ kind: z.literal('qualitative'), unit: z.string() }),
  z.object({ kind: z.literal('unknown') }),
])

const pantrySchema = z.object({
  id: z.string(),
  ingredientId: z.string(),
  amount: amountSchema,
  location: z.enum(['fridge', 'freezer', 'pantry']),
  openedAt: z.string().nullable().default(null),
  purchasedAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
})

const planEntrySchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  count: z.number().int().positive(),
  shape: z.enum(['round', 'rectangular']),
  diameterMm: z.number().nullable().default(null),
  trayWidthMm: z.number().nullable().default(null),
  trayHeightMm: z.number().nullable().default(null),
  ballWeightG: z.string().nullable().default(null),
  scaleMode: z.enum(['area', 'portion']),
  doughRecipeId: z.string().nullable().default(null),
  sauceRecipeId: z.string().nullable().default(null),
})

const cookSessionSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  versionId: z.string().nullable().default(null),
  startedAt: z.string(),
  finishedAt: z.string().nullable().default(null),
  scaleFactor: z.string().default('1'),
  rating: z.number().nullable().default(null),
  notes: z.string().nullable().default(null),
  completedStepIds: z.array(z.string()).default([]),
})

/** An immutable snapshot taken when a verified recipe is changed. */
const versionSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  versionNumber: z.number().int().positive(),
  createdAt: z.string(),
  isPrimary: z.boolean().default(false),
  note: z.string().nullable().default(null),
  /** The full recipe as it stood. Deliberately opaque here; typed on read. */
  snapshot: z.unknown(),
})

const settingsSchema = z.object({
  temperatureUnit: z.enum(['c', 'f']).default('c'),
  defaultDiameterMm: z.number().default(300),
  defaultBallWeightG: z.number().default(250),
  defaultOvenProfileId: z.string().nullable().default('home-oven'),
  includeExperimental: z.boolean().default(false),
})

const overlaySchema = z.object({
  version: z.literal(1).default(1),
  /** Recipes created or edited by the owner, keyed by slug. */
  recipes: z.record(z.string(), z.unknown()).default({}),
  /** Seed recipes the owner deleted; they stay hidden without touching the seed. */
  deletedRecipeSlugs: z.array(z.string()).default([]),
  /** Ingredients the owner created that are not in the seed catalog. */
  ingredients: z.record(z.string(), z.unknown()).default({}),
  versions: z.array(versionSchema).default([]),
  pantry: z.array(pantrySchema).default([]),
  plan: z
    .object({
      id: z.string().default('demo-plan'),
      serveAt: z.string().nullable().default(null),
      notes: z.string().nullable().default(null),
      entries: z.array(planEntrySchema).default([]),
    })
    .default({ id: 'demo-plan', serveAt: null, notes: null, entries: [] }),
  sessions: z.array(cookSessionSchema).default([]),
  settings: settingsSchema.default(() => settingsSchema.parse({})),
  /** Import candidates already approved, so a double submit cannot duplicate. */
  approvedImports: z.array(z.string()).default([]),
})

export type DemoOverlay = z.infer<typeof overlaySchema>
export type DemoPantryItem = z.infer<typeof pantrySchema>
export type DemoCookSession = z.infer<typeof cookSessionSchema>
export type DemoVersion = z.infer<typeof versionSchema>

export const EMPTY_OVERLAY: DemoOverlay = overlaySchema.parse({})

/** Recipes are stored in the seed's own authoring shape. */
export type StoredRecipe = SeedRecipe

function fileFor(sessionId: string): string {
  // The session id is validated by the caller; this guards the path anyway.
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(DATA_DIR, `${safe}.json`)
}

const cache = new Map<string, DemoOverlay>()

export async function readOverlay(sessionId: string): Promise<DemoOverlay> {
  const cached = cache.get(sessionId)
  if (cached) return cached

  try {
    const raw = await readFile(fileFor(sessionId), 'utf8')
    const parsed = overlaySchema.safeParse(JSON.parse(raw))
    // A malformed or outdated overlay resets rather than crashing every page.
    const overlay = parsed.success ? parsed.data : EMPTY_OVERLAY
    cache.set(sessionId, overlay)
    return overlay
  } catch {
    cache.set(sessionId, EMPTY_OVERLAY)
    return EMPTY_OVERLAY
  }
}

export async function writeOverlay(sessionId: string, overlay: DemoOverlay): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const target = fileFor(sessionId)
  const temp = `${target}.${process.pid}.tmp`

  // Write-then-rename: a reader never sees a partially written overlay.
  await writeFile(temp, JSON.stringify(overlay), 'utf8')
  await rename(temp, target)
  cache.set(sessionId, overlay)
}

export async function updateOverlay(
  sessionId: string,
  mutate: (overlay: DemoOverlay) => DemoOverlay,
): Promise<DemoOverlay> {
  const next = mutate(await readOverlay(sessionId))
  await writeOverlay(sessionId, next)
  return next
}

/** Discards every local change; the seed catalog reappears untouched. */
export async function resetOverlay(sessionId: string): Promise<void> {
  cache.delete(sessionId)
  try {
    await unlink(fileFor(sessionId))
  } catch {
    // Nothing stored yet, which is the same outcome the caller wanted.
  }
}
