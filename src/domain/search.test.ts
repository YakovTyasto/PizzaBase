import { describe, expect, it } from 'vitest'
import { buildAliasIndex, normalizeForSearch, scoreMatch, searchKey } from './search'

describe('search normalization', () => {
  it('folds case and strips punctuation', () => {
    expect(normalizeForSearch('Extra-Virgin Olive Oil!')).toBe('extra virgin olive oil')
  })

  it('strips Latin diacritics', () => {
    expect(searchKey('roquette')).toBe(searchKey('Roquette'))
    expect(searchKey('rùcola')).toBe('rucola')
    expect(searchKey('Pâte')).toBe('pate')
  })

  it('folds Cyrillic ё and й spelling differences', () => {
    expect(searchKey('Пармезан')).toBe('пармезан')
    expect(searchKey('чёрный')).toBe(searchKey('черный'))
  })
})

describe('multilingual alias matching', () => {
  const index = buildAliasIndex([
    { ingredientId: 'arugula', locale: 'en', alias: 'arugula' },
    { ingredientId: 'arugula', locale: 'en', alias: 'rocket' },
    { ingredientId: 'arugula', locale: 'fr', alias: 'roquette' },
    { ingredientId: 'arugula', locale: 'ru', alias: 'руккола' },
    { ingredientId: 'mozzarella', locale: 'en', alias: 'mozzarella' },
    { ingredientId: 'mozzarella', locale: 'ru', alias: 'моцарелла' },
  ])

  it('finds one ingredient from any of the three languages', () => {
    for (const query of ['arugula', 'rocket', 'roquette', 'руккола']) {
      expect(index.lookup(query)).toEqual(['arugula'])
    }
  })

  it('matches partial input', () => {
    expect(index.lookup('рукк')).toEqual(['arugula'])
    expect(index.lookup('arug')).toEqual(['arugula'])
  })

  it('finds a Russian ingredient from an English query and back', () => {
    expect(index.lookup('mozzarella')).toEqual(['mozzarella'])
    expect(index.lookup('моцарелла')).toEqual(['mozzarella'])
  })

  it('does not match unrelated ingredients', () => {
    expect(index.lookup('gorgonzola')).toEqual([])
  })

  it('answers per-ingredient membership questions', () => {
    expect(index.matches('arugula', 'roquette')).toBe(true)
    expect(index.matches('mozzarella', 'roquette')).toBe(false)
  })
})

describe('relevance scoring', () => {
  it('ranks exact above prefix above substring', () => {
    expect(scoreMatch('pepperoni', 'pepperoni')).toBe(100)
    expect(scoreMatch('pepperoni', 'pepp')).toBe(75)
    expect(scoreMatch('hot pepperoni', 'pepp')).toBe(50)
    expect(scoreMatch('mozzarella', 'pepp')).toBe(0)
  })
})
