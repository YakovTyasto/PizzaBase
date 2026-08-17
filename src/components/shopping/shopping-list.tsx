'use client'

import { Check, ChevronDown, Package } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { AmountDisplay } from '@/components/recipe/amount-display'
import { Badge, Card, CardBody } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { type WireAmount, deserializeAmount } from '@/lib/data/serialize'
import { cn } from '@/lib/utils'

export interface ShoppingItemWire {
  ingredientId: string
  required: WireAmount | null
  available: WireAmount | null
  toBuy: WireAmount | null
  optional: boolean
  fullyCovered: boolean
  separate: { amount: WireAmount; chain: string[] }[]
  packages: {
    label: string | null
    count: number
    net: WireAmount
    leftover: WireAmount | null
  } | null
  provenance: { chain: string[]; amount: WireAmount }[]
}

/**
 * The shopping list, grouped by department.
 *
 * Checked state is intentionally local: it is a scratchpad for one trip to the
 * shop, not a fact worth syncing, and persisting it would make the list feel
 * stale the next time the plan changes.
 */
export function ShoppingList({
  items,
  ingredients,
  categoryNames,
  recipeNames,
}: {
  items: ShoppingItemWire[]
  ingredients: Record<string, { name: string; categoryId: string }>
  categoryNames: Record<string, string>
  recipeNames: Record<string, string>
}) {
  const t = useTranslations()
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [includeOptional, setIncludeOptional] = useState(true)

  const grouped = useMemo(() => {
    const groups = new Map<string, ShoppingItemWire[]>()
    for (const item of items) {
      if (!includeOptional && item.optional) continue
      const categoryId = ingredients[item.ingredientId]?.categoryId ?? 'uncategorized'
      const bucket = groups.get(categoryId)
      if (bucket) bucket.push(item)
      else groups.set(categoryId, [item])
    }
    return [...groups.entries()]
  }, [items, ingredients, includeOptional])

  const toggle = (id: string) => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleCount = grouped.reduce((sum, [, list]) => sum + list.length, 0)

  if (visibleCount === 0) {
    return <p className="text-sm text-ink-muted">{t('shopping.empty')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={includeOptional}
            onChange={(event) => setIncludeOptional(event.target.checked)}
            className="size-4 accent-[var(--color-tomato)]"
          />
          {t('shopping.includeOptional')}
        </label>
        <Button variant="ghost" size="sm" onClick={() => setChecked(new Set())}>
          {t('shopping.uncheckAll')}
        </Button>
      </div>

      {grouped.map(([categoryId, list]) => (
        <section key={categoryId}>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
            {categoryNames[categoryId] ?? categoryId}
          </h2>
          <Card>
            <CardBody className="p-0 sm:p-0">
              <ul className="divide-y divide-rule">
                {list.map((item) => {
                  const isChecked = checked.has(item.ingredientId)
                  const name = ingredients[item.ingredientId]?.name ?? item.ingredientId
                  const isExpanded = expanded === item.ingredientId

                  return (
                    <li key={item.ingredientId} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          aria-label={name}
                          onClick={() => toggle(item.ingredientId)}
                          className={cn(
                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
                            isChecked
                              ? 'border-basil bg-basil text-white'
                              : 'border-rule bg-paper-raised',
                          )}
                        >
                          {isChecked ? <Check aria-hidden className="size-3.5" /> : null}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span
                              className={cn(
                                'text-sm font-medium',
                                isChecked ? 'text-ink-faint line-through' : 'text-ink',
                              )}
                            >
                              {name}
                              {item.optional ? (
                                <span className="ml-1.5 text-xs font-normal text-ink-faint">
                                  ({t('common.optional')})
                                </span>
                              ) : null}
                            </span>

                            {item.fullyCovered ? (
                              <Badge tone="good">{t('shopping.covered')}</Badge>
                            ) : item.toBuy ? (
                              <AmountDisplay amount={deserializeAmount(item.toBuy)} />
                            ) : null}
                          </div>

                          {/* Required / at home / to buy, so the deduction is visible. */}
                          {item.required && !item.fullyCovered ? (
                            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                              <span>
                                {t('shopping.required')}:{' '}
                                <AmountDisplay
                                  amount={deserializeAmount(item.required)}
                                  className="text-xs"
                                />
                              </span>
                              {item.available ? (
                                <span>
                                  {t('shopping.inPantry')}:{' '}
                                  <AmountDisplay
                                    amount={deserializeAmount(item.available)}
                                    className="text-xs"
                                  />
                                </span>
                              ) : null}
                            </p>
                          ) : null}

                          {item.packages ? (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted">
                              <Package aria-hidden className="size-3.5" />
                              {t('shopping.packages')}: {item.packages.count} ×{' '}
                              {item.packages.label ?? ''}
                              {item.packages.leftover ? (
                                <span className="text-ink-faint">
                                  {' · '}
                                  {t('shopping.leftover', { amount: '' })}
                                  <AmountDisplay
                                    amount={deserializeAmount(item.packages.leftover)}
                                    className="text-xs"
                                  />
                                </span>
                              ) : null}
                            </p>
                          ) : null}

                          {/* Qualitative and unmergeable lines stay visible. */}
                          {item.separate.length > 0 ? (
                            <p className="mt-1 text-xs text-ink-faint">
                              {t('shopping.separateLines')}:{' '}
                              {item.separate.map((line, index) => (
                                <span key={index}>
                                  {index > 0 ? ', ' : ''}
                                  <AmountDisplay
                                    amount={deserializeAmount(line.amount)}
                                    className="text-xs"
                                    showUnknownLabel={false}
                                  />
                                </span>
                              ))}
                            </p>
                          ) : null}

                          {item.provenance.length > 0 ? (
                            <div className="mt-1">
                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                onClick={() =>
                                  setExpanded(isExpanded ? null : item.ingredientId)
                                }
                                className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
                              >
                                <ChevronDown
                                  aria-hidden
                                  className={cn(
                                    'size-3 transition-transform',
                                    isExpanded && 'rotate-180',
                                  )}
                                />
                                {t('shopping.whyNeeded')}
                              </button>
                              {isExpanded ? (
                                <ul className="mt-1 space-y-0.5 pl-4">
                                  {item.provenance.map((line, index) => (
                                    <li key={index} className="text-xs text-ink-muted">
                                      {line.chain
                                        .map((id) => recipeNames[id] ?? id)
                                        .join(' → ')}
                                      {' · '}
                                      <AmountDisplay
                                        amount={deserializeAmount(line.amount)}
                                        className="text-xs"
                                        showUnknownLabel={false}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        </section>
      ))}
    </div>
  )
}
