import 'server-only'
import { isDemoMode } from '@/lib/config/env'
import type { MediaView } from '@/lib/media/types'

/**
 * Mints signed URLs for photos a page is about to render.
 *
 * Deliberately a separate call rather than something the repository does on
 * every read: signing is a network round trip, and a library listing that
 * signed every photo it returned would pay for pictures nobody scrolled to.
 * In demo mode there is nothing to sign and the media passes straight through.
 */
export async function signRecipeMedia<T extends MediaView>(media: T[]): Promise<T[]> {
  if (media.length === 0 || isDemoMode()) return media

  const { signMedia } = await import('./supabase/repository')
  return signMedia(media)
}

/**
 * Signs the cover photos of a list of recipes in one batch.
 *
 * The recipes come back with their covers replaced; anything without a cover
 * is untouched.
 */
export async function signCovers<T extends { cover: MediaView | null }>(
  recipes: T[],
): Promise<T[]> {
  if (isDemoMode()) return recipes

  const covers = recipes
    .map((recipe) => recipe.cover)
    .filter((cover): cover is MediaView => cover !== null)
  if (covers.length === 0) return recipes

  const signed = await signRecipeMedia(covers)
  const byId = new Map(signed.map((cover) => [cover.id, cover]))

  return recipes.map((recipe) =>
    recipe.cover ? { ...recipe, cover: byId.get(recipe.cover.id) ?? recipe.cover } : recipe,
  )
}
