import type { Locale } from '@/domain'
import type { MediaView } from '@/lib/media/types'
import type { SeedRecipe, SeedRecipeMedia } from '@/lib/seed/types'

/**
 * Projects stored photo records into what a screen renders.
 *
 * `url` stays null when the bytes are not reachable from the server -- demo
 * mode, where they are in the browser's IndexedDB. The client component that
 * renders a photo treats a null url as "look this up locally", which is what
 * keeps a single component working under both backends.
 */
export function mediaViews(media: readonly SeedRecipeMedia[], locale: Locale): MediaView[] {
  return media.map((photo) => ({
    id: photo.id,
    url: photo.url ?? null,
    alt: photo.alt?.[locale]?.trim() || photo.alt?.en?.trim() || photo.alt?.ru?.trim() || null,
    isCover: photo.isCover ?? false,
  }))
}

/** The photo a card shows: the chosen cover, else the first one. */
export function coverOf(recipe: SeedRecipe, locale: Locale): MediaView | null {
  const views = mediaViews(recipe.media ?? [], locale)
  return views.find((photo) => photo.isCover) ?? views[0] ?? null
}
