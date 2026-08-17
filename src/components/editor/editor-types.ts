import type { RecipeDraft } from '@/lib/data/recipe-draft'

/** Reference data the editor needs to offer choices rather than free text. */
export interface EditorOptions {
  ingredients: { slug: string; name: string; baseUnit: string; measure: string }[]
  components: { slug: string; name: string; type: string }[]
  styles: { id: string; name: string }[]
  ovens: { id: string; name: string }[]
  categories: { id: string; name: string }[]
}

export function emptyDraft(type: RecipeDraft['type']): RecipeDraft {
  return {
    slug: null,
    type,
    status: 'draft',
    authenticity: 'user_verified',
    styleSlug: null,
    ovenProfileSlug: null,
    originLocale: 'ru',
    baseYield: type === 'pizza' ? '1' : null,
    yieldUnit: type === 'pizza' ? 'piece' : null,
    baseDiameterMm: type === 'pizza' ? 300 : null,
    baseShape: type === 'pizza' ? 'round' : null,
    baseTrayWidthMm: null,
    baseTrayHeightMm: null,
    baseBallWeightG: type === 'pizza' || type === 'dough' ? '250' : null,
    activeMinutes: null,
    passiveMinutes: null,
    difficulty: null,
    tags: [],
    names: { ru: '', en: '', fr: '' },
    summaries: { ru: '', en: '', fr: '' },
    notes: { ru: '', en: '', fr: '' },
    items: [],
    steps: [],
    source: {
      sourceType: 'user',
      author: null,
      title: null,
      url: null,
      credibilityTier: 0.7,
      attribution: null,
    },
    evidence: [],
    media: [],
    createVersion: false,
    versionNote: null,
  }
}

/** Keys are stable within a recipe and only need to be unique among siblings. */
export function nextKey(prefix: string, taken: readonly { key: string }[]): string {
  const existing = new Set(taken.map((entry) => entry.key))
  for (let n = 1; n < 1000; n++) {
    const candidate = `${prefix}-${n}`
    if (!existing.has(candidate)) return candidate
  }
  return `${prefix}-${Date.now()}`
}
