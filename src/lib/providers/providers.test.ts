import { describe, expect, it } from 'vitest'
import { hasBlockingIssues, recipeExtractionSchema, validateExtraction } from './extraction-schema'
import { mockExtraction } from './mock'
import { parseQuantityString } from './product-lookup'
import { formatTimecode } from '@/lib/format'
import { InvalidYouTubeUrlError, parseYouTubeUrl } from './transcript'

describe('YouTube URL handling', () => {
  it('accepts the supported link shapes', () => {
    const expected = 'o35mHoq5v0s'
    for (const url of [
      'https://www.youtube.com/watch?v=o35mHoq5v0s',
      'https://youtube.com/watch?v=o35mHoq5v0s&t=30s',
      'https://youtu.be/o35mHoq5v0s',
      'https://m.youtube.com/watch?v=o35mHoq5v0s',
      'https://www.youtube.com/embed/o35mHoq5v0s',
      'https://www.youtube.com/shorts/o35mHoq5v0s',
      'o35mHoq5v0s',
    ]) {
      expect(parseYouTubeUrl(url), url).toBe(expected)
    }
  })

  it('refuses any other host, which is the SSRF guard', () => {
    for (const url of [
      'https://evil.example.com/watch?v=o35mHoq5v0s',
      'http://169.254.169.254/latest/meta-data/',
      'https://youtube.com.evil.example/watch?v=o35mHoq5v0s',
      'file:///etc/passwd',
      'not a url',
    ]) {
      expect(() => parseYouTubeUrl(url), url).toThrow(InvalidYouTubeUrlError)
    }
  })

  it('refuses a malformed video id', () => {
    expect(() => parseYouTubeUrl('https://www.youtube.com/watch?v=tooshort')).toThrow()
    expect(() => parseYouTubeUrl('https://www.youtube.com/watch?v=has spaces!!')).toThrow()
  })

  it('formats timecodes', () => {
    expect(formatTimecode(0)).toBe('0:00')
    expect(formatTimecode(75)).toBe('1:15')
    expect(formatTimecode(3661)).toBe('1:01:01')
  })
})

describe('Open Food Facts quantity parsing', () => {
  it('reads common package strings', () => {
    expect(parseQuantityString('400 g')).toEqual({ value: '400', unit: 'g' })
    expect(parseQuantityString('1.5 l')).toEqual({ value: '1.5', unit: 'l' })
    expect(parseQuantityString('125g')).toEqual({ value: '125', unit: 'g' })
    expect(parseQuantityString('0,5 kg')).toEqual({ value: '0.5', unit: 'kg' })
  })

  it('normalizes centilitres into millilitres', () => {
    expect(parseQuantityString('75 cl')).toEqual({ value: '750', unit: 'ml' })
  })

  it('returns null rather than guessing', () => {
    expect(parseQuantityString(undefined)).toBeNull()
    expect(parseQuantityString('family size')).toBeNull()
    expect(parseQuantityString('6 pieces')).toBeNull()
  })
})

describe('extraction schema', () => {
  it('accepts the mock fixture', () => {
    const parsed = recipeExtractionSchema.safeParse(mockExtraction({ text: 'x' }))
    expect(parsed.success).toBe(true)
  })

  it('lets a source say it never stated an amount', () => {
    const extraction = mockExtraction({ text: 'x' })
    const yeast = extraction.ingredients.find((i) => i.name === 'Active dry yeast')
    expect(yeast?.amount.kind).toBe('unknown')
  })

  it('keeps a disputed amount as a range instead of averaging it', () => {
    const extraction = mockExtraction({ text: 'x' })
    const salt = extraction.ingredients.find((i) => i.name === 'Salt')
    expect(salt?.amount).toMatchObject({ kind: 'range', min: '12', max: '15' })
  })

  it('rejects an amount with no unit', () => {
    const broken = {
      ...mockExtraction({ text: 'x' }),
      ingredients: [
        {
          name: 'Flour',
          amount: { kind: 'exact', value: '500' },
          optional: false,
          group: null,
          note: null,
          startSeconds: null,
        },
      ],
    }
    expect(recipeExtractionSchema.safeParse(broken).success).toBe(false)
  })
})

describe('extraction validation', () => {
  it('surfaces the fixture conflict as a warning', () => {
    const issues = validateExtraction(mockExtraction({ text: 'x' }))
    expect(issues.some((issue) => issue.field === 'salt amount')).toBe(true)
    // A conflict needs review but does not block the review screen itself.
    expect(hasBlockingIssues(issues)).toBe(false)
  })

  it('flags an inverted range as an error', () => {
    const extraction = mockExtraction({ text: 'x' })
    extraction.ingredients[2] = {
      ...extraction.ingredients[2]!,
      amount: { kind: 'range', min: '15', max: '12', unit: 'g' },
    }
    const issues = validateExtraction(extraction)
    expect(hasBlockingIssues(issues)).toBe(true)
  })

  it('flags an inverted wait window', () => {
    const extraction = mockExtraction({ text: 'x' })
    extraction.steps[0] = {
      ...extraction.steps[0]!,
      waitMinMinutes: 90,
      waitMaxMinutes: 30,
    }
    expect(hasBlockingIssues(validateExtraction(extraction))).toBe(true)
  })

  it('warns about duplicate ingredients', () => {
    const extraction = mockExtraction({ text: 'x' })
    extraction.ingredients.push({ ...extraction.ingredients[0]! })
    const issues = validateExtraction(extraction)
    expect(issues.some((issue) => issue.message.includes('appears 2 times'))).toBe(true)
  })

  it('warns about an implausible temperature', () => {
    const extraction = mockExtraction({ text: 'x' })
    extraction.steps[0] = { ...extraction.steps[0]!, temperatureC: 5000 }
    const issues = validateExtraction(extraction)
    expect(issues.some((issue) => issue.message.includes('implausible'))).toBe(true)
  })

  it('errors when nothing was extracted', () => {
    const extraction = { ...mockExtraction({ text: 'x' }), ingredients: [] }
    expect(hasBlockingIssues(validateExtraction(extraction))).toBe(true)
  })
})
