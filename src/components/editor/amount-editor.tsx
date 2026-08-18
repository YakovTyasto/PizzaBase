'use client'

import { useTranslations } from 'next-intl'
import {
  COUNT_UNITS,
  MASS_UNITS,
  PACKAGE_UNITS,
  QUALITATIVE_UNITS,
  VOLUME_UNITS,
  type Unit,
} from '@/domain'
import { Input, Select } from '@/components/ui/primitives'
import type { DraftAmount } from '@/lib/data/recipe-draft'
import { cn } from '@/lib/utils'

const NUMERIC_UNITS: Unit[] = [...MASS_UNITS, ...VOLUME_UNITS, ...COUNT_UNITS, ...PACKAGE_UNITS]

/**
 * Edits one quantity.
 *
 * "Unknown" is a real choice here, sitting alongside the others rather than
 * being the absence of one. That is what lets the owner record a recipe they
 * have not measured yet without the app inventing a number for them.
 */
export function AmountEditor({
  value,
  onChange,
  idPrefix,
}: {
  value: DraftAmount
  onChange: (next: DraftAmount) => void
  idPrefix: string
}) {
  const t = useTranslations()

  const currentUnit = 'unit' in value ? value.unit : 'g'

  const setKind = (kind: DraftAmount['kind']) => {
    switch (kind) {
      case 'exact':
        onChange({
          kind: 'exact',
          value: value.kind === 'range' ? value.min : '',
          unit: NUMERIC_UNITS.includes(currentUnit as Unit) ? currentUnit : 'g',
        })
        break
      case 'range':
        onChange({
          kind: 'range',
          min: value.kind === 'exact' ? value.value : '',
          max: '',
          unit: NUMERIC_UNITS.includes(currentUnit as Unit) ? currentUnit : 'g',
        })
        break
      case 'qualitative':
        onChange({ kind: 'qualitative', unit: 'to_taste' })
        break
      case 'unknown':
        onChange({ kind: 'unknown' })
        break
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_1fr_auto]">
      <Select
        aria-label={t('editor.amountKind')}
        id={`${idPrefix}-kind`}
        value={value.kind}
        onChange={(event) => setKind(event.target.value as DraftAmount['kind'])}
        className="col-span-2 sm:col-span-1 sm:w-36"
      >
        <option value="exact">{t('editor.amountExact')}</option>
        <option value="range">{t('editor.amountRange')}</option>
        <option value="qualitative">{t('editor.amountQualitative')}</option>
        <option value="unknown">{t('editor.amountUnknown')}</option>
      </Select>

      {value.kind === 'exact' ? (
        <>
          <Input
            id={`${idPrefix}-value`}
            aria-label={t('pantry.quantity')}
            inputMode="decimal"
            placeholder="0"
            value={value.value}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
          />
          <div />
        </>
      ) : null}

      {value.kind === 'range' ? (
        <>
          <Input
            id={`${idPrefix}-min`}
            aria-label={t('editor.rangeMin')}
            inputMode="decimal"
            placeholder="min"
            value={value.min}
            onChange={(event) => onChange({ ...value, min: event.target.value })}
          />
          <Input
            id={`${idPrefix}-max`}
            aria-label={t('editor.rangeMax')}
            inputMode="decimal"
            placeholder="max"
            value={value.max}
            onChange={(event) => onChange({ ...value, max: event.target.value })}
          />
        </>
      ) : null}

      {value.kind === 'qualitative' ? (
        <Select
          id={`${idPrefix}-qualitative`}
          aria-label={t('settings.units')}
          value={value.unit}
          onChange={(event) => onChange({ kind: 'qualitative', unit: event.target.value })}
          className="col-span-2"
        >
          {QUALITATIVE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {t(`units.${unit}`, { count: 1 })}
            </option>
          ))}
        </Select>
      ) : null}

      {value.kind === 'unknown' ? (
        <p
          className={cn(
            'bg-amber-soft text-amber col-span-2 flex items-center rounded-lg px-3 text-xs sm:col-span-3',
          )}
        >
          {t('amount.unknownHint')}
        </p>
      ) : null}

      {value.kind === 'exact' || value.kind === 'range' ? (
        <Select
          id={`${idPrefix}-unit`}
          aria-label={t('settings.units')}
          value={value.unit}
          onChange={(event) => onChange({ ...value, unit: event.target.value })}
          className="col-span-2 sm:col-span-1 sm:w-32"
        >
          {NUMERIC_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {t(`units.${unit}`, { count: 1 })}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  )
}
