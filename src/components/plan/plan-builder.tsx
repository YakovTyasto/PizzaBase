'use client'

import { Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { savePlanAction } from '@/app/actions/plan'
import { Button } from '@/components/ui/button'
import { type DisplayError, useErrorText } from '@/components/ui/action-error'
import {
  Card,
  CardBody,
  EmptyState,
  Input,
  Label,
  NumericInput,
  Select,
} from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import type { MealPlanView, PlanEntry, RecipeSummary } from '@/lib/data/types'

/**
 * Builds a pizza night: several different pizzas, each with its own count and
 * size. This is the input the consolidated shopping list is computed from.
 */
export function PlanBuilder({
  plan,
  recipes,
  recipeNames,
  writable,
}: {
  plan: MealPlanView
  recipes: RecipeSummary[]
  recipeNames: Record<string, string>
  /** False on a read-only deployment: every control is disabled up front. */
  writable: boolean
}) {
  const t = useTranslations()
  const [entries, setEntries] = useState<PlanEntry[]>(plan.entries)
  const [serveAt, setServeAt] = useState(plan.serveAt?.slice(0, 16) ?? '')
  const [selected, setSelected] = useState(recipes[0]?.id ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<DisplayError | null>(null)
  const errorText = useErrorText()

  /**
   * Applies a change, then withdraws it if the server refused.
   *
   * The optimistic update is what makes the screen feel immediate, but it is a
   * *prediction*, and a prediction that turns out wrong has to be taken back.
   * Leaving the pizza on screen after the write failed is what made a read-only
   * deployment look like it was saving: the row appeared, and only a reload
   * revealed it had never existed.
   */
  const persist = (next: PlanEntry[], nextServeAt = serveAt) => {
    const previousEntries = entries
    const previousServeAt = serveAt
    setEntries(next)
    setError(null)
    startTransition(async () => {
      const result = await savePlanAction({
        id: plan.id,
        serveAt: nextServeAt ? new Date(nextServeAt).toISOString() : null,
        notes: plan.notes,
        entries: next,
      })
      if (!result.ok) {
        setEntries(previousEntries)
        setServeAt(previousServeAt)
        setError(result.error)
      }
    })
  }

  const addEntry = () => {
    if (!selected || !writable) return
    const existing = entries.find((entry) => entry.recipeId === selected)
    if (existing) {
      persist(
        entries.map((entry) =>
          entry.recipeId === selected ? { ...entry, count: Math.min(99, entry.count + 1) } : entry,
        ),
      )
      return
    }
    const recipe = recipes.find((r) => r.id === selected)
    persist([
      ...entries,
      {
        id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        recipeId: selected,
        count: 1,
        shape: 'round',
        diameterMm: 300,
        trayWidthMm: null,
        trayHeightMm: null,
        ballWeightG: null,
        scaleMode: 'area',
        doughRecipeId: null,
        sauceRecipeId: null,
      },
    ])
    void recipe
  }

  const update = (id: string, patch: Partial<PlanEntry>) => {
    persist(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }

  const totalPizzas = entries.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="plan-recipe">{t('plan.addPizza')}</Label>
              <Select
                id="plan-recipe"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name.value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={addEntry}
                disabled={!selected || pending || !writable}
                className="w-full sm:w-auto"
              >
                <Plus aria-hidden />
                {t('common.add')}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="plan-serve">{t('plan.serveAt')}</Label>
            {/* datetime-local keeps its native picker. It is not a spinbutton,
                and typing a date by hand would be strictly worse. */}
            <Input
              id="plan-serve"
              type="datetime-local"
              value={serveAt}
              disabled={!writable}
              onChange={(event) => {
                setServeAt(event.target.value)
                persist(entries, event.target.value)
              }}
            />
          </div>
        </CardBody>
      </Card>

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

      {entries.length === 0 ? (
        <EmptyState title={t('plan.empty')} hint={t('plan.emptyHint')} />
      ) : (
        <>
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Card>
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-ink font-medium">
                        {recipeNames[entry.recipeId] ?? entry.recipeId}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('plan.remove')}
                        disabled={!writable || pending}
                        onClick={() =>
                          persist(entries.filter((candidate) => candidate.id !== entry.id))
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label htmlFor={`count-${entry.id}`}>{t('plan.count')}</Label>
                        <NumericInput
                          id={`count-${entry.id}`}
                          value={entry.count}
                          disabled={!writable}
                          onChange={(event) => {
                            // Out-of-range input is ignored rather than
                            // rewritten, so a partly typed number survives.
                            const parsed = Number(event.target.value.trim())
                            if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) return
                            update(entry.id, { count: parsed })
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`diameter-${entry.id}`}>{t('recipe.diameter')} (mm)</Label>
                        <NumericInput
                          id={`diameter-${entry.id}`}
                          value={entry.diameterMm ?? 300}
                          disabled={!writable}
                          onChange={(event) => {
                            const parsed = Number(event.target.value.trim())
                            if (!Number.isInteger(parsed) || parsed < 100 || parsed > 800) return
                            update(entry.id, { diameterMm: parsed })
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`mode-${entry.id}`}>{t('recipe.scale')}</Label>
                        <Select
                          id={`mode-${entry.id}`}
                          disabled={!writable}
                          value={entry.scaleMode}
                          onChange={(event) =>
                            update(entry.id, {
                              scaleMode: event.target.value as PlanEntry['scaleMode'],
                            })
                          }
                        >
                          <option value="area">{t('recipe.scaleByArea')}</option>
                          <option value="portion">{t('recipe.scaleByPortion')}</option>
                        </Select>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink-muted text-sm">
              {t('plan.totalPizzas', { count: totalPizzas })}
            </p>
            <Link href="/shopping">
              <Button>
                <ShoppingBasket aria-hidden />
                {t('plan.generateList')}
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
