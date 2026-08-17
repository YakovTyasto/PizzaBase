import type { Amount } from './amount'

/** Test helper: renders an exact amount's numeric value, or null. */
export function exactAmountOf(amount: Amount | undefined | null): string | null {
  if (!amount) return null
  if (amount.kind === 'exact') return amount.value.toString()
  return null
}

/** Test helper: renders any amount as a compact string. */
export function formatForTest(amount: Amount | undefined | null): string {
  if (!amount) return 'none'
  switch (amount.kind) {
    case 'exact':
      return `${amount.value.toString()} ${amount.unit}`
    case 'range':
      return `${amount.min.toString()}-${amount.max.toString()} ${amount.unit}`
    case 'qualitative':
      return amount.unit
    case 'unknown':
      return 'unknown'
  }
}
