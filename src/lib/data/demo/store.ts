import 'server-only'
import { cookies } from 'next/headers'
import { z } from 'zod'
import type { MealPlanView, PantryItemView, UserSettingsView } from '../types'

/**
 * Demo-mode user state.
 *
 * Recipes and ingredients come from the bundled seed, but the pantry, plan and
 * settings are things the user changes -- and a demo where the pantry resets on
 * every request would not actually demonstrate pantry deduction. Storing them
 * in a cookie keeps demo mode genuinely usable on a stateless host without
 * pretending to be a database, and the badge in the header says as much.
 */

const COOKIE_NAME = 'impasto_demo'
/** Browsers cap a cookie at ~4 KB; stay well clear and fail soft if exceeded. */
const MAX_COOKIE_BYTES = 3500

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
  startedAt: z.string(),
  finishedAt: z.string().nullable().default(null),
  scaleFactor: z.string().default('1'),
  rating: z.number().nullable().default(null),
  notes: z.string().nullable().default(null),
  completedStepIds: z.array(z.string()).default([]),
})

const settingsSchema = z.object({
  temperatureUnit: z.enum(['c', 'f']).default('c'),
  defaultDiameterMm: z.number().default(300),
  defaultBallWeightG: z.number().default(250),
  defaultOvenProfileId: z.string().nullable().default('home-oven'),
  includeExperimental: z.boolean().default(false),
})

const stateSchema = z.object({
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
  // The callback form lets the field defaults above supply the whole object.
  settings: settingsSchema.default(() => settingsSchema.parse({})),
})

export type DemoState = z.infer<typeof stateSchema>
export type DemoPantryItem = z.infer<typeof pantrySchema>
export type DemoCookSession = z.infer<typeof cookSessionSchema>

export const EMPTY_DEMO_STATE: DemoState = stateSchema.parse({})

export async function readDemoState(): Promise<DemoState> {
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return EMPTY_DEMO_STATE

  try {
    const parsed = stateSchema.safeParse(JSON.parse(decodeURIComponent(raw)))
    // A malformed or outdated cookie resets rather than crashing the page.
    return parsed.success ? parsed.data : EMPTY_DEMO_STATE
  } catch {
    return EMPTY_DEMO_STATE
  }
}

/**
 * Persists demo state. Only callable from a Server Action or Route Handler --
 * Next.js forbids setting cookies while rendering, which is the correct
 * constraint here since reads must never mutate.
 */
export async function writeDemoState(state: DemoState): Promise<void> {
  const encoded = encodeURIComponent(JSON.stringify(state))
  if (encoded.length > MAX_COOKIE_BYTES) {
    throw new Error(
      'Demo state is too large for a cookie. Connect Supabase to keep working with this much data.',
    )
  }
  const store = await cookies()
  store.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
}

export async function updateDemoState(
  mutate: (state: DemoState) => DemoState,
): Promise<DemoState> {
  const next = mutate(await readDemoState())
  await writeDemoState(next)
  return next
}

export function toPlanView(state: DemoState): MealPlanView {
  return {
    id: state.plan.id,
    serveAt: state.plan.serveAt,
    notes: state.plan.notes,
    entries: state.plan.entries,
  }
}

export function toSettingsView(state: DemoState, locale: UserSettingsView['locale']): UserSettingsView {
  return { ...state.settings, locale }
}

export type { PantryItemView }
