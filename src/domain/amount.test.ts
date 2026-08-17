import { describe, expect, it } from 'vitest'
import {
  type Amount,
  addAmounts,
  exact,
  isNumeric,
  parseAmount,
  qualitative,
  range,
  scaleAmount,
  serializeAmount,
  subtractAmount,
} from './amount'

const str = (a: Amount) =>
  a.kind === 'exact'
    ? `${a.value.toString()} ${a.unit}`
    : a.kind === 'range'
      ? `${a.min.toString()}-${a.max.toString()} ${a.unit}`
      : a.kind === 'qualitative'
        ? a.unit
        : 'unknown'

describe('amounts', () => {
  it('parses exact, range, qualitative and unknown rows', () => {
    expect(str(parseAmount({ amount: '100', unit: 'g' }))).toBe('100 g')
    expect(str(parseAmount({ amount: '1', amount_max: '2', unit: 'clove' }))).toBe('1-2 clove')
    expect(str(parseAmount({ amount: null, unit: 'to_taste' }))).toBe('to_taste')
    expect(str(parseAmount({ amount: null, unit: null }))).toBe('unknown')
  })

  it('treats a missing unit as unknown rather than guessing grams', () => {
    expect(parseAmount({ amount: '50', unit: null }).kind).toBe('unknown')
  })

  it('round-trips through serialization', () => {
    const a = range(1, 2, 'clove')
    expect(str(parseAmount(serializeAmount(a) as never))).toBe('1-2 clove')
  })

  it('scales exact and range amounts', () => {
    expect(str(scaleAmount(exact(100, 'g'), 2.5))).toBe('250 g')
    expect(str(scaleAmount(range(1, 2, 'clove'), 3))).toBe('3-6 clove')
  })

  it('never turns a qualitative quantity into a number', () => {
    const salt = qualitative('to_taste')
    const scaled = scaleAmount(salt, 10)
    expect(scaled.kind).toBe('qualitative')
    expect(isNumeric(scaled)).toBe(false)
    expect(str(scaled)).toBe('to_taste')

    const pinch = scaleAmount(qualitative('pinch'), 4)
    expect(str(pinch)).toBe('pinch')
  })

  it('leaves unknown amounts unknown when scaled', () => {
    expect(scaleAmount({ kind: 'unknown' }, 7).kind).toBe('unknown')
  })

  it('adds amounts after normalizing units', () => {
    expect(str(addAmounts(exact(1, 'kg'), exact(500, 'g')))).toBe('1.5 kg')
    expect(str(addAmounts(exact(250, 'ml'), exact(1, 'l')))).toBe('1250 ml')
  })

  it('widens to a range when adding a range', () => {
    expect(str(addAmounts(exact(100, 'g'), range(1, 2, 'g')))).toBe('101-102 g')
  })

  it('refuses to add across incompatible measures', () => {
    expect(() => addAmounts(exact(100, 'g'), exact(2, 'piece'))).toThrow()
    expect(() => addAmounts(exact(100, 'g'), qualitative('to_taste'))).toThrow()
  })

  it('adds volume to mass when a density is supplied', () => {
    expect(str(addAmounts(exact(9, 'g'), exact(100, 'ml'), '0.91'))).toBe('100 g')
  })

  it('clamps subtraction at zero', () => {
    expect(str(subtractAmount(exact(100, 'g'), exact(250, 'g')))).toBe('0 g')
    expect(str(subtractAmount(exact(300, 'g'), exact(100, 'g')))).toBe('200 g')
  })
})
