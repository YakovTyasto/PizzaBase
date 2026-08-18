import { describe, expect, it } from 'vitest'
import { compareInvariants, extractInvariants } from './invariants'

describe('what a translation may not change', () => {
  it('finds plain numbers', () => {
    expect(extractInvariants('Add 500 g of flour and 325 g of water')).toEqual([
      { kind: 'number', value: '500' },
      { kind: 'number', value: '325' },
    ])
  })

  it('treats a decimal comma and a decimal point as one figure', () => {
    const russian = extractInvariants('0,16 г дрожжей')
    const english = extractInvariants('0.16 g yeast')
    expect(russian).toEqual(english)
  })

  it('ignores trailing zeros, which are not a change of value', () => {
    expect(compareInvariants('2.50%', '2,5 %').ok).toBe(true)
  })

  it('reads a temperature as a temperature, not as a loose number', () => {
    expect(extractInvariants('Bake at 250 °C')).toEqual([
      { kind: 'temperature', value: '250°C' },
    ])
  })

  it('does not count a URL as a pile of numbers', () => {
    expect(extractInvariants('See https://example.test/watch?v=12345')).toEqual([
      { kind: 'url', value: 'https://example.test/watch?v=12345' },
    ])
  })

  it('reads a timecode as one token', () => {
    expect(extractInvariants('At 12:45 he adds the salt')).toEqual([
      { kind: 'timecode', value: '12:45' },
    ])
  })
})

describe('comparing a translation against its source', () => {
  it('accepts a faithful translation', () => {
    const diff = compareInvariants(
      'Bake at 250 °C for 90 seconds.',
      'Выпекайте при 250 °C в течение 90 секунд.',
    )
    expect(diff.ok).toBe(true)
  })

  it('accepts numbers appearing in a different order', () => {
    expect(compareInvariants('500 g flour, 325 g water', '325 г воды, 500 г муки').ok).toBe(true)
  })

  it('refuses a helpfully converted temperature', () => {
    // The exact failure this guard exists for: fluent, plausible, and wrong.
    const diff = compareInvariants('Bake at 250 °C', 'Bake at 480 °F')
    expect(diff.ok).toBe(false)
    expect(diff.missing).toContainEqual({ kind: 'temperature', value: '250°C' })
    expect(diff.added).toContainEqual({ kind: 'temperature', value: '480°F' })
  })

  it('refuses a rounded quantity', () => {
    expect(compareInvariants('Add 12.5 g of salt', 'Добавьте 13 г соли').ok).toBe(false)
  })

  it('refuses a dropped number', () => {
    const diff = compareInvariants('Rest for 20 to 30 minutes', 'Дайте отдохнуть полчаса')
    expect(diff.ok).toBe(false)
    expect(diff.missing).toHaveLength(2)
  })

  it('refuses an invented number', () => {
    const diff = compareInvariants('Add a pinch of salt', 'Добавьте 5 г соли')
    expect(diff.ok).toBe(false)
    expect(diff.added).toContainEqual({ kind: 'number', value: '5' })
  })

  it('refuses a changed link', () => {
    expect(
      compareInvariants('See https://a.test/x', 'Смотрите https://b.test/x').ok,
    ).toBe(false)
  })

  it('refuses a shifted timecode', () => {
    expect(compareInvariants('At 12:45', 'В 12:46').ok).toBe(false)
  })

  it('accepts text with no figures at all', () => {
    expect(compareInvariants('Knead until smooth', 'Месите до гладкости').ok).toBe(true)
  })

  it('keeps a repeated figure counted, not deduplicated', () => {
    // Two 200s in, one 200 out is a loss even though the value still appears.
    expect(compareInvariants('200 g and 200 ml', '200 г и немного молока').ok).toBe(false)
  })
})
