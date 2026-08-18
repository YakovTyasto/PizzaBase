'use client'

import { Plus, Refrigerator, ScanLine, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { addPantryItemAction, removePantryItemAction } from '@/app/actions/pantry'
import { AmountDisplay } from '@/components/recipe/amount-display'
import { type DisplayError, useErrorText } from '@/components/ui/action-error'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, EmptyState, Input, Label, Select } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { COUNT_UNITS, MASS_UNITS, PACKAGE_UNITS, VOLUME_UNITS, type Unit } from '@/domain'
import { type WireAmount, deserializeAmount } from '@/lib/data/serialize'

interface PantryRow {
  id: string
  ingredientId: string
  name: string
  amount: WireAmount
  location: 'fridge' | 'freezer' | 'pantry'
  expiresAt: string | null
}

/**
 * Units offered are constrained to the ingredient's own measure, so a user
 * cannot record "2 litres of mozzarella" and then wonder why the shopping list
 * refuses to deduct it.
 */
function unitsForMeasure(measure: string): readonly Unit[] {
  if (measure === 'volume') return [...VOLUME_UNITS, ...MASS_UNITS]
  if (measure === 'count') return [...COUNT_UNITS, ...PACKAGE_UNITS]
  if (measure === 'package') return PACKAGE_UNITS
  return [...MASS_UNITS, ...VOLUME_UNITS]
}

export function PantryManager({
  items,
  ingredients,
  writable,
}: {
  items: PantryRow[]
  ingredients: { id: string; name: string; baseUnit: Unit; measure: string }[]
  /** False on a read-only deployment: adding and removing are refused up front. */
  writable: boolean
}) {
  const t = useTranslations()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<DisplayError | null>(null)
  const errorText = useErrorText()

  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const selected = ingredients.find((i) => i.id === ingredientId)
  const availableUnits = unitsForMeasure(selected?.measure ?? 'mass')
  const [unit, setUnit] = useState<Unit>(selected?.baseUnit ?? 'g')
  const [location, setLocation] = useState<PantryRow['location']>('fridge')

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await addPantryItemAction({
        ingredientId,
        quantity,
        unit,
        location,
      })
      if (result.ok) setQuantity('')
      else setError(result.error)
    })
  }

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await removePantryItemAction(id)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="pantry-ingredient">{t('recipe.ingredients')}</Label>
              <Select
                id="pantry-ingredient"
                value={ingredientId}
                onChange={(event) => {
                  setIngredientId(event.target.value)
                  const next = ingredients.find((i) => i.id === event.target.value)
                  if (next) setUnit(next.baseUnit)
                }}
              >
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="pantry-quantity">{t('pantry.quantity')}</Label>
              <Input
                id="pantry-quantity"
                type="text"
                inputMode="decimal"
                value={quantity}
                placeholder="500"
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="pantry-unit">{t('settings.units')}</Label>
              <Select
                id="pantry-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value as Unit)}
              >
                {availableUnits.map((code) => (
                  <option key={code} value={code}>
                    {t(`units.${code}`, { count: 1 })}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="pantry-location">{t('pantry.location')}</Label>
              <Select
                id="pantry-location"
                value={location}
                onChange={(event) => setLocation(event.target.value as PantryRow['location'])}
              >
                <option value="fridge">{t('pantry.fridge')}</option>
                <option value="freezer">{t('pantry.freezer')}</option>
                <option value="pantry">{t('pantry.pantryLocation')}</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={pending || !quantity || !ingredientId || !writable}>
              <Plus aria-hidden />
              {t('pantry.add')}
            </Button>
            <Link href="/scan">
              <Button variant="outline">
                <ScanLine aria-hidden />
                {t('pantry.scanInstead')}
              </Button>
            </Link>
          </div>

          {!writable ? (
            <p className="bg-amber-soft text-amber rounded-lg px-3 py-2 text-sm">
              {t('demo.readOnlyHint')}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-tomato text-sm">
              {errorText(error)}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={<Refrigerator className="size-6" />}
          title={t('pantry.empty')}
          hint={t('pantry.emptyHint')}
        />
      ) : (
        <Card>
          <CardBody className="p-0 sm:p-0">
            <ul className="divide-rule divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-sm font-medium">{item.name}</p>
                    <p className="mt-0.5 flex items-center gap-2">
                      <AmountDisplay amount={deserializeAmount(item.amount)} />
                      <Badge tone="outline">
                        {item.location === 'fridge'
                          ? t('pantry.fridge')
                          : item.location === 'freezer'
                            ? t('pantry.freezer')
                            : t('pantry.pantryLocation')}
                      </Badge>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('common.delete')}
                    disabled={pending || !writable}
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
