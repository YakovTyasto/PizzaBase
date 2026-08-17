import type { RecipeExtraction } from './extraction-schema'
import type { RecipeExtractionInput } from './types'

/**
 * A deterministic extraction fixture.
 *
 * It exists so the import flow can be used and tested with no API key, and it
 * deliberately includes the awkward cases the review screen has to handle:
 * an unknown amount, a disputed range, and a self-reported conflict. A fixture
 * of clean data would prove nothing.
 */
export function mockExtraction(input: RecipeExtractionInput): RecipeExtraction {
  return {
    title: input.title ?? 'Sample dough from an imported source',
    summary: 'A mock extraction used when no AI provider is configured.',
    detectedLanguage: 'en',
    type: 'dough',
    style: null,
    yieldCount: '3',
    yieldUnit: 'piece',
    ballWeightG: null,
    ingredients: [
      {
        name: 'Type 00 flour',
        amount: { kind: 'exact', value: '500', unit: 'g' },
        optional: false,
        group: 'final',
        note: null,
        startSeconds: input.hasTimecodes ? 42 : null,
      },
      {
        name: 'Water',
        amount: { kind: 'exact', value: '325', unit: 'g' },
        optional: false,
        group: 'final',
        note: null,
        startSeconds: input.hasTimecodes ? 58 : null,
      },
      {
        name: 'Salt',
        // The kind of disagreement the review screen must surface.
        amount: { kind: 'range', min: '12', max: '15', unit: 'g' },
        optional: false,
        group: 'final',
        note: 'The source states two different figures.',
        startSeconds: input.hasTimecodes ? 96 : null,
      },
      {
        name: 'Active dry yeast',
        amount: { kind: 'unknown', reason: 'The source never states a weight.' },
        optional: false,
        group: 'final',
        note: null,
        startSeconds: null,
      },
      {
        name: 'Olive oil',
        amount: { kind: 'qualitative', unit: 'as_needed' },
        optional: true,
        group: 'final',
        note: null,
        startSeconds: null,
      },
    ],
    steps: [
      {
        instruction: 'Combine the flour and water and rest the mixture.',
        phase: 'mix',
        activeMinutes: 15,
        waitMinMinutes: 20,
        waitMaxMinutes: 30,
        temperatureC: null,
        sensoryCues: 'The dough should look shaggy, not smooth, at this stage.',
        startSeconds: input.hasTimecodes ? 120 : null,
      },
      {
        instruction: 'Ferment at room temperature.',
        phase: 'bulk',
        activeMinutes: 0,
        waitMinMinutes: 480,
        waitMaxMinutes: 1440,
        temperatureC: null,
        sensoryCues: 'Ready when visibly risen and domed.',
        startSeconds: input.hasTimecodes ? 300 : null,
      },
    ],
    equipment: ['Mixing bowl', 'Bench scraper'],
    conflicts: [
      {
        field: 'salt amount',
        description:
          'The source says 12 g at one point and 15 g at another. Recorded as a range pending confirmation.',
      },
    ],
    overallConfidence: 0.55,
  }
}
