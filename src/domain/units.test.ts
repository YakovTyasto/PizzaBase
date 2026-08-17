import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  UnitConversionError,
  areConvertible,
  convert,
  convertWithDensity,
  measureOf,
  preferredDisplayUnit,
} from './units'

describe('unit conversion', () => {
  it('normalizes mass units', () => {
    expect(convert(1.5, 'kg', 'g').toString()).toBe('1500')
    expect(convert(2500, 'g', 'kg').toString()).toBe('2.5')
    expect(convert(500, 'mg', 'g').toString()).toBe('0.5')
  })

  it('normalizes volume units', () => {
    expect(convert(1.25, 'l', 'ml').toString()).toBe('1250')
    expect(convert(750, 'ml', 'l').toString()).toBe('0.75')
    expect(convert(3, 'tsp', 'ml').toString()).toBe('15')
    expect(convert(1, 'tbsp', 'tsp').toString()).toBe('3')
  })

  it('refuses to convert between different measures', () => {
    expect(() => convert(100, 'ml', 'g')).toThrow(UnitConversionError)
    expect(() => convert(1, 'piece', 'g')).toThrow(UnitConversionError)
    expect(areConvertible('ml', 'g')).toBe(false)
  })

  it('keeps count units separate from each other', () => {
    // A clove is not a leaf and neither is a generic piece.
    expect(areConvertible('clove', 'piece')).toBe(false)
    expect(areConvertible('leaf', 'bunch')).toBe(false)
    expect(areConvertible('clove', 'clove')).toBe(true)
    expect(measureOf('clove')).toBe('count')
  })

  it('keeps package units separate from each other', () => {
    expect(areConvertible('can', 'jar')).toBe(false)
    expect(areConvertible('pack', 'pack')).toBe(true)
  })

  it('rejects volume-to-mass without a density', () => {
    expect(() => convertWithDensity(100, 'ml', 'g', null)).toThrow(UnitConversionError)
    expect(() => convertWithDensity(100, 'ml', 'g', undefined)).toThrow(/density/)
  })

  it('converts volume to mass with an ingredient density', () => {
    // Olive oil is 0.91 g/ml, so 100 ml is 91 g -- never 100 g.
    expect(convertWithDensity(100, 'ml', 'g', '0.91').toString()).toBe('91')
    expect(convertWithDensity(91, 'g', 'ml', '0.91').toString()).toBe('100')
  })

  it('rejects a non-positive density', () => {
    expect(() => convertWithDensity(100, 'ml', 'g', '0')).toThrow(UnitConversionError)
  })

  it('picks friendly display units', () => {
    expect(preferredDisplayUnit(new Decimal(1500), 'g')).toBe('kg')
    expect(preferredDisplayUnit(new Decimal(999), 'g')).toBe('g')
    expect(preferredDisplayUnit(new Decimal(0.4), 'l')).toBe('ml')
  })
})
