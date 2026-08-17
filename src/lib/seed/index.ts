import {
  categories,
  ingredients,
  ovenProfiles,
  packageOptions,
  styles,
  substitutions,
} from './ingredients'
import { recipes } from './recipes'
import type { SeedCatalog } from './types'

export const seedCatalog: SeedCatalog = {
  categories,
  ingredients,
  packageOptions,
  substitutions,
  styles,
  ovenProfiles,
  recipes,
}

export * from './types'
export { categories, ingredients, ovenProfiles, packageOptions, recipes, styles, substitutions }
