import 'server-only'
import type { Locale } from '@/domain'
import { getRepository } from '@/lib/data'
import type { EditorOptions } from './editor-types'

/**
 * Reference data for the editor's pickers.
 *
 * `excludeSlug` keeps a recipe out of its own component list. That is not the
 * cycle check -- the repository and the database still enforce that -- it just
 * removes the most obvious mistake from the menu before it can be made.
 */
export async function loadEditorOptions(
  locale: Locale,
  excludeSlug?: string,
): Promise<EditorOptions> {
  const repository = getRepository()

  const [ingredients, recipes, styles, ovens, categories] = await Promise.all([
    repository.listIngredients(locale),
    repository.listRecipes(locale),
    repository.listStyles(locale),
    repository.listOvenProfiles(locale),
    repository.listCategories(locale),
  ])

  return {
    ingredients: ingredients.map((ingredient) => ({
      slug: ingredient.slug,
      name: ingredient.name.value,
      baseUnit: ingredient.baseUnit,
      measure: ingredient.measure,
    })),
    components: recipes
      .filter((recipe) => recipe.type !== 'pizza' && recipe.slug !== excludeSlug)
      .map((recipe) => ({
        slug: recipe.slug,
        name: recipe.name.value,
        type: recipe.type,
      })),
    styles: styles.map((style) => ({ id: style.id, name: style.name.value })),
    ovens: ovens.map((oven) => ({ id: oven.id, name: oven.name.value })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name.value,
    })),
  }
}
