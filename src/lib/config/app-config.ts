/**
 * The single place the product's name lives. Changing `name` here renames the
 * app everywhere -- title, manifest, PWA install prompt, .ics calendar name,
 * Open Food Facts user agent -- with no refactor.
 */
export const appConfig = {
  name: 'Impasto',
  shortName: 'Impasto',
  tagline: {
    ru: 'Личная книга пицца-рецептов',
    en: 'A personal pizza recipe book',
    fr: 'Le carnet de recettes à pizza',
  },
  themeColor: '#2B2B28',
  backgroundColor: '#FBF8F3',
  /** Used in the Open Food Facts user agent when the env var is unset. */
  version: '1.0',
} as const

export type AppConfig = typeof appConfig
