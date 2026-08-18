'use client'

import { Decimal } from 'decimal.js'
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { saveRecipeAction } from '@/app/actions/recipes'
import { computeBakersPercentages } from '@/domain'
import { Button } from '@/components/ui/button'
import {
  Badge,
  Card,
  CardBody,
  DataRow,
  Input,
  Label,
  SectionHeading,
  Select,
  Textarea,
} from '@/components/ui/primitives'
import { useRouter } from '@/i18n/navigation'
import type { DraftValidationIssue, RecipeDraft } from '@/lib/data/recipe-draft'
import { validateDraft } from '@/lib/data/recipe-draft'
import { useOffline } from '@/lib/client-env'
import { enqueue } from '@/lib/offline/queue'
import { cn } from '@/lib/utils'
import { AmountEditor } from './amount-editor'
import { type EditorOptions, nextKey } from './editor-types'
import { roleForIngredient } from '@/components/recipe/dough-formula'

const LOCALES = ['ru', 'en', 'fr'] as const
type EditorLocale = (typeof LOCALES)[number]

const SECTIONS = ['general', 'ingredients', 'steps', 'source'] as const
type Section = (typeof SECTIONS)[number]

/**
 * The recipe editor.
 *
 * One client component holding the whole draft, because every section reads
 * from the same object: changing an ingredient's weight updates the baker's
 * percentages, and renaming an ingredient line has to keep the steps that
 * reference it in step. Splitting the state across sections would mean
 * synchronising it back together.
 *
 * Validation runs on every change but only *displays* after a save attempt, so
 * the form does not scold the owner for a recipe they are still typing.
 */
export function RecipeEditor({
  initial,
  options,
  isNew,
}: {
  initial: RecipeDraft
  options: EditorOptions
  isNew: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [draft, setDraft] = useState<RecipeDraft>(initial)
  const [locale, setLocale] = useState<EditorLocale>(initial.originLocale)
  const [section, setSection] = useState<Section>('general')
  const [showErrors, setShowErrors] = useState(false)
  const [serverIssues, setServerIssues] = useState<DraftValidationIssue[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [queued, setQueued] = useState(false)
  const offline = useOffline()

  const update = useCallback((patch: Partial<RecipeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
    setSaved(false)
  }, [])

  const issues = useMemo(() => validateDraft(draft), [draft])
  const visibleIssues = showErrors ? [...issues, ...serverIssues] : serverIssues
  const issueFor = (path: string) => visibleIssues.find((issue) => issue.path === path)

  // Warn on navigating away with unsaved work.
  const beforeUnload = useCallback(() => dirty, [dirty])
  useBeforeUnload(beforeUnload)

  const bakers = useMemo(() => {
    if (draft.type !== 'dough') return null
    const components = draft.items.flatMap((item) => {
      if (!item.ingredientSlug || item.amount.kind !== 'exact') return []
      if (item.amount.unit !== 'g' && item.amount.unit !== 'kg') return []
      const grams =
        item.amount.unit === 'kg'
          ? new Decimal(item.amount.value.replace(',', '.') || 0).times(1000)
          : new Decimal(item.amount.value.replace(',', '.') || 0)
      return [
        {
          ingredientId: item.ingredientSlug,
          role: roleForIngredient(item.ingredientSlug),
          grams: grams.toString(),
          stage: (item.group === 'poolish' || item.group === 'biga'
            ? 'preferment'
            : 'final') as 'preferment' | 'final',
        },
      ]
    })
    if (!components.some((c) => c.role === 'flour')) return null
    try {
      return computeBakersPercentages({ preferment: 'none', components })
    } catch {
      return null
    }
  }, [draft.type, draft.items])

  const submit = () => {
    setShowErrors(true)
    setServerIssues([])
    setError(null)

    if (issues.length > 0) {
      setError(t('editor.fixErrors'))
      return
    }

    startTransition(async () => {
      try {
        const result = await saveRecipeAction(draft)
        if (result.ok) {
          setDirty(false)
          setSaved(true)
          setQueued(false)
          router.push(`/recipes/${result.slug}`)
          return
        }
        // The UI must never claim success when nothing was written.
        setSaved(false)
        setError(result.error)
        setServerIssues(result.issues ?? [])
        if (result.cycle) {
          setError(t('errors.cycleHint', { chain: result.cycle.join(' → ') }))
        }
      } catch (cause) {
        // The request itself never reached the server. Drafts are one of the
        // two things safe to replay later, so it is queued rather than lost --
        // and labelled as queued, not as saved.
        if (offline || cause instanceof TypeError) {
          enqueue('recipe-draft', draft.slug ?? `new-${draft.names[draft.originLocale]}`, draft)
          setQueued(true)
          setDirty(false)
          setError(null)
          return
        }
        setError(cause instanceof Error ? cause.message : t('errors.generic'))
      }
    })
  }

  const localizedField = (
    field: 'names' | 'summaries' | 'notes',
    label: string,
    multiline = false,
  ) => {
    const value = draft[field][locale]
    const id = `${field}-${locale}`
    const issue = issueFor(`${field}.${locale}`) ?? issueFor(field)
    return (
      <div>
        <Label htmlFor={id}>{label}</Label>
        {multiline ? (
          <Textarea
            id={id}
            rows={3}
            value={value}
            aria-invalid={issue ? true : undefined}
            onChange={(event) =>
              update({ [field]: { ...draft[field], [locale]: event.target.value } } as never)
            }
          />
        ) : (
          <Input
            id={id}
            value={value}
            aria-invalid={issue ? true : undefined}
            onChange={(event) =>
              update({ [field]: { ...draft[field], [locale]: event.target.value } } as never)
            }
          />
        )}
        {issue ? <FieldError message={issue.message} /> : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Language tabs: one recipe, three translations. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label={t('settings.language')}
          className="inline-flex rounded-full border border-rule p-0.5"
        >
          {LOCALES.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={locale === option}
              onClick={() => setLocale(option)}
              className={cn(
                'min-w-12 rounded-full px-3 py-1.5 text-xs font-semibold uppercase transition-colors',
                locale === option
                  ? 'bg-ink text-paper'
                  : 'text-ink-muted hover:bg-paper-sunken',
              )}
            >
              {option}
              {option === draft.originLocale ? (
                <span className="ml-1 text-[0.625rem] normal-case opacity-70">
                  {t('editor.origin')}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {dirty ? <Badge tone="warn">{t('editor.unsaved')}</Badge> : null}
          {saved ? <Badge tone="good">{t('editor.saved')}</Badge> : null}
          {queued ? <Badge tone="accent">{t('sync.offlineSaved')}</Badge> : null}
        </div>
      </div>

      {/* Section tabs */}
      <div className="scroll-x">
        <div role="tablist" aria-label={t('editor.sections')} className="flex w-max gap-1">
          {SECTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={section === option}
              onClick={() => setSection(option)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                section === option
                  ? 'bg-tomato-soft text-tomato-strong'
                  : 'text-ink-muted hover:bg-paper-sunken',
              )}
            >
              {t(`editor.section.${option}`)}
            </button>
          ))}
        </div>
      </div>

      {section === 'general' ? (
        <GeneralSection
          draft={draft}
          update={update}
          options={options}
          localizedField={localizedField}
          issueFor={issueFor}
        />
      ) : null}

      {section === 'ingredients' ? (
        <IngredientsSection
          draft={draft}
          update={update}
          options={options}
          locale={locale}
          issueFor={issueFor}
          bakers={bakers}
        />
      ) : null}

      {section === 'steps' ? (
        <StepsSection draft={draft} update={update} locale={locale} issueFor={issueFor} />
      ) : null}

      {section === 'source' ? (
        <SourceSection draft={draft} update={update} locale={locale} />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-tomato-soft px-3 py-2 text-sm text-tomato-strong"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {error}
            {visibleIssues.length > 0 ? (
              <ul className="mt-1 list-disc pl-4">
                {visibleIssues.slice(0, 6).map((issue, index) => (
                  <li key={index}>
                    {issue.path}: {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </span>
        </p>
      ) : null}

      {/* Sticky save bar so the action is reachable from any section. */}
      <div className="sticky bottom-20 z-20 flex flex-wrap gap-2 rounded-[var(--radius-card)] border border-rule bg-paper-raised/95 p-3 backdrop-blur lg:bottom-4">
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          {isNew ? t('editor.create') : t('common.save')}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (dirty && !window.confirm(t('editor.discardConfirm'))) return
            router.back()
          }}
        >
          {t('common.cancel')}
        </Button>

        {!isNew && draft.status === 'verified' ? (
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={draft.createVersion}
              onChange={(event) => update({ createVersion: event.target.checked })}
              className="size-4 accent-[var(--color-tomato)]"
            />
            {t('history.createVersion')}
          </label>
        ) : null}
      </div>
    </div>
  )
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="mt-1 text-xs text-tomato" role="alert">
      {message}
    </p>
  )
}

// ---------------------------------------------------------------------------

function GeneralSection({
  draft,
  update,
  options,
  localizedField,
  issueFor,
}: {
  draft: RecipeDraft
  update: (patch: Partial<RecipeDraft>) => void
  options: EditorOptions
  localizedField: (
    field: 'names' | 'summaries' | 'notes',
    label: string,
    multiline?: boolean,
  ) => React.ReactNode
  issueFor: (path: string) => DraftValidationIssue | undefined
}) {
  const t = useTranslations()

  return (
    <Card>
      <CardBody className="space-y-4">
        {localizedField('names', t('editor.name'))}
        {localizedField('summaries', t('editor.summary'), true)}
        {localizedField('notes', t('recipe.notes'), true)}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="type">{t('recipes.filterType')}</Label>
            <Select
              id="type"
              value={draft.type}
              onChange={(event) => update({ type: event.target.value as RecipeDraft['type'] })}
            >
              {(['pizza', 'dough', 'sauce', 'prep'] as const).map((type) => (
                <option key={type} value={type}>
                  {t(`recipeType.${type}`)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="status">{t('recipes.filterStatus')}</Label>
            <Select
              id="status"
              value={draft.status}
              onChange={(event) => update({ status: event.target.value as RecipeDraft['status'] })}
              aria-invalid={issueFor('status') ? true : undefined}
            >
              {(['draft', 'needs_review', 'verified'] as const).map((status) => (
                <option key={status} value={status}>
                  {t(`status.${status}`)}
                </option>
              ))}
            </Select>
            {issueFor('status') ? <FieldError message={issueFor('status')!.message} /> : null}
          </div>

          <div>
            <Label htmlFor="authenticity">{t('recipes.filterAuthenticity')}</Label>
            <Select
              id="authenticity"
              value={draft.authenticity}
              onChange={(event) =>
                update({ authenticity: event.target.value as RecipeDraft['authenticity'] })
              }
            >
              {(
                [
                  'user_verified',
                  'traditional',
                  'pizzaiolo',
                  'modern_italian',
                  'adapted',
                  'experimental',
                ] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {t(`authenticity.${value}`)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="originLocale">{t('editor.originLocale')}</Label>
            <Select
              id="originLocale"
              value={draft.originLocale}
              onChange={(event) =>
                update({ originLocale: event.target.value as RecipeDraft['originLocale'] })
              }
            >
              {LOCALES.map((value) => (
                <option key={value} value={value}>
                  {t(`locale.${value}`)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="style">{t('recipe.style')}</Label>
            <Select
              id="style"
              value={draft.styleSlug ?? ''}
              onChange={(event) => update({ styleSlug: event.target.value || null })}
            >
              <option value="">{t('common.none')}</option>
              {options.styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="oven">{t('recipe.oven')}</Label>
            <Select
              id="oven"
              value={draft.ovenProfileSlug ?? ''}
              onChange={(event) => update({ ovenProfileSlug: event.target.value || null })}
            >
              <option value="">{t('common.none')}</option>
              {options.ovens.map((oven) => (
                <option key={oven.id} value={oven.id}>
                  {oven.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <SectionHeading>{t('editor.sizeAndYield')}</SectionHeading>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="baseYield">{t('recipe.yield')}</Label>
            <Input
              id="baseYield"
              inputMode="decimal"
              placeholder={t('recipe.yieldUnknown')}
              value={draft.baseYield ?? ''}
              aria-invalid={issueFor('baseYield') ? true : undefined}
              onChange={(event) => update({ baseYield: event.target.value || null })}
            />
            {issueFor('baseYield') ? <FieldError message={issueFor('baseYield')!.message} /> : null}
          </div>

          <div>
            <Label htmlFor="yieldUnit">{t('settings.units')}</Label>
            <Select
              id="yieldUnit"
              value={draft.yieldUnit ?? ''}
              onChange={(event) =>
                update({ yieldUnit: (event.target.value || null) as RecipeDraft['yieldUnit'] })
              }
              aria-invalid={issueFor('yieldUnit') ? true : undefined}
            >
              <option value="">{t('common.none')}</option>
              {(['g', 'kg', 'ml', 'l', 'piece'] as const).map((unit) => (
                <option key={unit} value={unit}>
                  {t(`units.${unit}`, { count: 1 })}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="shape">{t('recipe.shape')}</Label>
            <Select
              id="shape"
              value={draft.baseShape ?? ''}
              onChange={(event) =>
                update({ baseShape: (event.target.value || null) as RecipeDraft['baseShape'] })
              }
            >
              <option value="">{t('common.none')}</option>
              <option value="round">{t('recipe.round')}</option>
              <option value="rectangular">{t('recipe.rectangular')}</option>
            </Select>
          </div>

          {draft.baseShape === 'round' ? (
            <div>
              <Label htmlFor="diameter">{t('recipe.diameter')} (mm)</Label>
              <Input
                id="diameter"
                type="number"
                inputMode="numeric"
                value={draft.baseDiameterMm ?? ''}
                aria-invalid={issueFor('baseDiameterMm') ? true : undefined}
                onChange={(event) =>
                  update({ baseDiameterMm: event.target.value ? Number(event.target.value) : null })
                }
              />
              {issueFor('baseDiameterMm') ? (
                <FieldError message={issueFor('baseDiameterMm')!.message} />
              ) : null}
            </div>
          ) : null}

          {draft.baseShape === 'rectangular' ? (
            <>
              <div>
                <Label htmlFor="trayW">{t('editor.trayWidth')} (mm)</Label>
                <Input
                  id="trayW"
                  type="number"
                  value={draft.baseTrayWidthMm ?? ''}
                  onChange={(event) =>
                    update({
                      baseTrayWidthMm: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="trayH">{t('editor.trayHeight')} (mm)</Label>
                <Input
                  id="trayH"
                  type="number"
                  value={draft.baseTrayHeightMm ?? ''}
                  onChange={(event) =>
                    update({
                      baseTrayHeightMm: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </div>
            </>
          ) : null}

          <div>
            <Label htmlFor="ballWeight">{t('recipe.ballWeight')} (g)</Label>
            <Input
              id="ballWeight"
              inputMode="decimal"
              value={draft.baseBallWeightG ?? ''}
              onChange={(event) => update({ baseBallWeightG: event.target.value || null })}
            />
          </div>

          <div>
            <Label htmlFor="activeMinutes">{t('recipe.activeTime')} (min)</Label>
            <Input
              id="activeMinutes"
              type="number"
              value={draft.activeMinutes ?? ''}
              onChange={(event) =>
                update({ activeMinutes: event.target.value ? Number(event.target.value) : null })
              }
            />
          </div>

          <div>
            <Label htmlFor="passiveMinutes">{t('cooking.waiting')} (min)</Label>
            <Input
              id="passiveMinutes"
              type="number"
              value={draft.passiveMinutes ?? ''}
              onChange={(event) =>
                update({ passiveMinutes: event.target.value ? Number(event.target.value) : null })
              }
            />
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------

function IngredientsSection({
  draft,
  update,
  options,
  locale,
  issueFor,
  bakers,
}: {
  draft: RecipeDraft
  update: (patch: Partial<RecipeDraft>) => void
  options: EditorOptions
  locale: EditorLocale
  issueFor: (path: string) => DraftValidationIssue | undefined
  bakers: ReturnType<typeof computeBakersPercentages> | null
}) {
  const t = useTranslations()

  const setItem = (index: number, patch: Partial<RecipeDraft['items'][number]>) => {
    const items = draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    update({ items })
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= draft.items.length) return
    const items = [...draft.items]
    const [moved] = items.splice(index, 1)
    items.splice(target, 0, moved!)
    update({ items })
  }

  const addIngredient = () => {
    update({
      items: [
        ...draft.items,
        {
          key: nextKey('item', draft.items),
          ingredientSlug: options.ingredients[0]?.slug ?? null,
          componentSlug: null,
          amount: { kind: 'unknown' },
          optional: false,
          group: null,
          notes: { ru: '', en: '', fr: '' },
        },
      ],
    })
  }

  const addComponent = () => {
    update({
      items: [
        ...draft.items,
        {
          key: nextKey('component', draft.items),
          ingredientSlug: null,
          componentSlug: options.components[0]?.slug ?? null,
          amount: { kind: 'unknown' },
          optional: false,
          group: null,
          notes: { ru: '', en: '', fr: '' },
        },
      ],
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={addIngredient}>
              <Plus aria-hidden />
              {t('editor.addIngredient')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addComponent}
              disabled={options.components.length === 0}
              title={options.components.length === 0 ? t('editor.noComponents') : undefined}
            >
              <Plus aria-hidden />
              {t('editor.addComponent')}
            </Button>
          </div>

          {draft.items.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">{t('editor.noIngredients')}</p>
          ) : (
            <ul className="space-y-3">
              {draft.items.map((item, index) => (
                <li key={item.key} className="rounded-lg border border-rule p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {item.componentSlug !== null ? (
                        <>
                          <Label htmlFor={`item-${index}-component`}>
                            {t('recipes.components')}
                          </Label>
                          <Select
                            id={`item-${index}-component`}
                            value={item.componentSlug ?? ''}
                            onChange={(event) =>
                              setItem(index, { componentSlug: event.target.value })
                            }
                          >
                            {options.components.map((component) => (
                              <option key={component.slug} value={component.slug}>
                                {component.name}
                              </option>
                            ))}
                          </Select>
                        </>
                      ) : (
                        <>
                          <Label htmlFor={`item-${index}-ingredient`}>
                            {t('recipe.ingredients')}
                          </Label>
                          <Select
                            id={`item-${index}-ingredient`}
                            value={item.ingredientSlug ?? ''}
                            onChange={(event) =>
                              setItem(index, { ingredientSlug: event.target.value })
                            }
                          >
                            {options.ingredients.map((ingredient) => (
                              <option key={ingredient.slug} value={ingredient.slug}>
                                {ingredient.name}
                              </option>
                            ))}
                          </Select>
                        </>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-1 pt-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('editor.moveUp')}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('editor.moveDown')}
                        disabled={index === draft.items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('common.delete')}
                        onClick={() =>
                          update({ items: draft.items.filter((_, i) => i !== index) })
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <AmountEditor
                    idPrefix={`item-${index}`}
                    value={item.amount}
                    onChange={(amount) => setItem(index, { amount })}
                  />
                  {issueFor(`items.${index}.amount`) ? (
                    <FieldError message={issueFor(`items.${index}.amount`)!.message} />
                  ) : null}

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`item-${index}-group`}>{t('editor.group')}</Label>
                      <Input
                        id={`item-${index}-group`}
                        placeholder={t('editor.groupPlaceholder')}
                        value={item.group ?? ''}
                        onChange={(event) => setItem(index, { group: event.target.value || null })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`item-${index}-note`}>{t('editor.preparationNote')}</Label>
                      <Input
                        id={`item-${index}-note`}
                        value={item.notes?.[locale] ?? ''}
                        onChange={(event) =>
                          setItem(index, {
                            notes: {
                              ru: item.notes?.ru ?? '',
                              en: item.notes?.en ?? '',
                              fr: item.notes?.fr ?? '',
                              [locale]: event.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={item.optional}
                      onChange={(event) => setItem(index, { optional: event.target.checked })}
                      className="size-4 accent-[var(--color-tomato)]"
                    />
                    {t('common.optional')}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Live baker's percentages, recomputed from the same domain function
          the recipe page uses. */}
      {bakers ? (
        <Card>
          <CardBody>
            <SectionHeading>{t('recipe.bakersPercentages')}</SectionHeading>
            <dl>
              <DataRow label={t('recipe.hydration')}>
                {bakers.hydrationPct.toDecimalPlaces(2).toString()}%
              </DataRow>
              <DataRow label={t('recipe.salt')}>
                {bakers.saltPct.toDecimalPlaces(2).toString()}%
              </DataRow>
              <DataRow label={t('recipe.yeast')}>
                {bakers.yeastPct.toDecimalPlaces(3).toString()}%
              </DataRow>
              <DataRow label={t('recipe.totalDough')}>
                {bakers.totalDoughG.toDecimalPlaces(0).toString()} g
              </DataRow>
            </dl>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------

function StepsSection({
  draft,
  update,
  locale,
  issueFor,
}: {
  draft: RecipeDraft
  update: (patch: Partial<RecipeDraft>) => void
  locale: EditorLocale
  issueFor: (path: string) => DraftValidationIssue | undefined
}) {
  const t = useTranslations()

  const setStep = (index: number, patch: Partial<RecipeDraft['steps'][number]>) => {
    update({ steps: draft.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) })
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= draft.steps.length) return
    const steps = [...draft.steps]
    const [moved] = steps.splice(index, 1)
    steps.splice(target, 0, moved!)
    update({ steps })
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            update({
              steps: [
                ...draft.steps,
                {
                  key: nextKey('step', draft.steps),
                  phase: 'prep',
                  activeMinutes: 0,
                  waitMinMinutes: 0,
                  waitMaxMinutes: 0,
                  durationKnown: true,
                  temperatureC: null,
                  timerSeconds: null,
                  itemKeys: [],
                  instructions: { ru: '', en: '', fr: '' },
                  cues: { ru: '', en: '', fr: '' },
                  troubleshooting: { ru: '', en: '', fr: '' },
                },
              ],
            })
          }
        >
          <Plus aria-hidden />
          {t('editor.addStep')}
        </Button>

        {draft.steps.length === 0 ? (
          <p className="py-4 text-sm text-ink-muted">{t('recipe.noSteps')}</p>
        ) : (
          <ol className="space-y-3">
            {draft.steps.map((step, index) => (
              <li key={step.key} className="rounded-lg border border-rule p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-muted">{index + 1}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('editor.moveUp')}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('editor.moveDown')}
                      disabled={index === draft.steps.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('common.delete')}
                      onClick={() => update({ steps: draft.steps.filter((_, i) => i !== index) })}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>

                <Label htmlFor={`step-${index}-instruction`}>{t('editor.instruction')}</Label>
                <Textarea
                  id={`step-${index}-instruction`}
                  rows={2}
                  value={step.instructions[locale]}
                  aria-invalid={issueFor(`steps.${index}.instructions`) ? true : undefined}
                  onChange={(event) =>
                    setStep(index, {
                      instructions: { ...step.instructions, [locale]: event.target.value },
                    })
                  }
                />
                {issueFor(`steps.${index}.instructions`) ? (
                  <FieldError message={issueFor(`steps.${index}.instructions`)!.message} />
                ) : null}

                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor={`step-${index}-phase`}>{t('editor.phase')}</Label>
                    <Select
                      id={`step-${index}-phase`}
                      value={step.phase}
                      onChange={(event) =>
                        setStep(index, {
                          phase: event.target.value as RecipeDraft['steps'][number]['phase'],
                        })
                      }
                    >
                      {(
                        [
                          'preferment', 'mix', 'bulk', 'fold', 'ball', 'cold_proof',
                          'warm_up', 'shape', 'bake', 'serve', 'prep', 'other',
                        ] as const
                      ).map((phase) => (
                        <option key={phase} value={phase}>
                          {t(`phase.${phase}`)}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor={`step-${index}-active`}>{t('cooking.activeWork')} (min)</Label>
                    <Input
                      id={`step-${index}-active`}
                      type="number"
                      min={0}
                      value={step.activeMinutes}
                      onChange={(event) =>
                        setStep(index, { activeMinutes: Number(event.target.value) || 0 })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor={`step-${index}-waitmin`}>{t('planner.short')} (min)</Label>
                    <Input
                      id={`step-${index}-waitmin`}
                      type="number"
                      min={0}
                      value={step.waitMinMinutes}
                      onChange={(event) =>
                        setStep(index, { waitMinMinutes: Number(event.target.value) || 0 })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor={`step-${index}-waitmax`}>{t('planner.long')} (min)</Label>
                    <Input
                      id={`step-${index}-waitmax`}
                      type="number"
                      min={0}
                      value={step.waitMaxMinutes}
                      onChange={(event) =>
                        setStep(index, { waitMaxMinutes: Number(event.target.value) || 0 })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor={`step-${index}-temp`}>{t('cooking.temperature')} (°C)</Label>
                    <Input
                      id={`step-${index}-temp`}
                      type="number"
                      value={step.temperatureC ?? ''}
                      onChange={(event) =>
                        setStep(index, {
                          temperatureC: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor={`step-${index}-timer`}>{t('cooking.timer')} (s)</Label>
                    <Input
                      id={`step-${index}-timer`}
                      type="number"
                      value={step.timerSeconds ?? ''}
                      onChange={(event) =>
                        setStep(index, {
                          timerSeconds: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <Label htmlFor={`step-${index}-cues`}>{t('cooking.cues')}</Label>
                  <Input
                    id={`step-${index}-cues`}
                    value={step.cues?.[locale] ?? ''}
                    onChange={(event) =>
                      setStep(index, {
                        cues: {
                          ru: step.cues?.ru ?? '',
                          en: step.cues?.en ?? '',
                          fr: step.cues?.fr ?? '',
                          [locale]: event.target.value,
                        },
                      })
                    }
                  />
                </div>

                <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={!step.durationKnown}
                    onChange={(event) => setStep(index, { durationKnown: !event.target.checked })}
                    className="size-4 accent-[var(--color-tomato)]"
                  />
                  {t('editor.durationUnknown')}
                </label>

                {/* Which ingredients this step uses, for cooking mode. */}
                {draft.items.length > 0 ? (
                  <fieldset className="mt-2">
                    <legend className="mb-1 text-xs text-ink-muted">
                      {t('cooking.ingredientsForStep')}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {draft.items.map((item) => (
                        <label key={item.key} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={step.itemKeys.includes(item.key)}
                            onChange={(event) =>
                              setStep(index, {
                                itemKeys: event.target.checked
                                  ? [...step.itemKeys, item.key]
                                  : step.itemKeys.filter((key) => key !== item.key),
                              })
                            }
                            className="size-3.5 accent-[var(--color-tomato)]"
                          />
                          {item.key}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}

// ---------------------------------------------------------------------------

function SourceSection({
  draft,
  update,
  locale,
}: {
  draft: RecipeDraft
  update: (patch: Partial<RecipeDraft>) => void
  locale: EditorLocale
}) {
  const t = useTranslations()
  const source = draft.source

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <SectionHeading>{t('recipe.source')}</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="sourceType">{t('recipe.source')}</Label>
              <Select
                id="sourceType"
                value={source?.sourceType ?? 'user'}
                onChange={(event) =>
                  update({
                    source: {
                      sourceType: event.target.value as NonNullable<
                        RecipeDraft['source']
                      >['sourceType'],
                      author: source?.author ?? null,
                      title: source?.title ?? null,
                      url: source?.url ?? null,
                      credibilityTier: source?.credibilityTier ?? 0.7,
                      attribution: source?.attribution ?? null,
                    },
                  })
                }
              >
                {(
                  ['user', 'youtube', 'official', 'website', 'photo', 'text', 'ai_assisted'] as const
                ).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="sourceAuthor">{t('recipe.attribution')}</Label>
              <Input
                id="sourceAuthor"
                value={source?.author ?? ''}
                onChange={(event) =>
                  update({
                    source: {
                      ...(source ?? {
                        sourceType: 'user' as const,
                        title: null,
                        url: null,
                        credibilityTier: 0.7,
                        attribution: null,
                      }),
                      author: event.target.value || null,
                    },
                  })
                }
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="sourceUrl">URL</Label>
              <Input
                id="sourceUrl"
                type="url"
                value={source?.url ?? ''}
                onChange={(event) =>
                  update({
                    source: {
                      ...(source ?? {
                        sourceType: 'user' as const,
                        author: null,
                        title: null,
                        credibilityTier: 0.7,
                        attribution: null,
                      }),
                      url: event.target.value || null,
                    },
                  })
                }
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Evidence: what is still in doubt, and how confident the owner is. */}
      <Card>
        <CardBody className="space-y-3">
          <SectionHeading
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  update({
                    evidence: [
                      ...draft.evidence,
                      {
                        field: 'recipe.method',
                        itemKey: null,
                        confidence: 0,
                        reviewState: 'needs_review',
                        conflictGroup: null,
                        startSeconds: null,
                        notes: { ru: '', en: '', fr: '' },
                      },
                    ],
                  })
                }
              >
                <Plus aria-hidden />
                {t('common.add')}
              </Button>
            }
          >
            {t('recipe.evidence')}
          </SectionHeading>

          {draft.evidence.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('editor.noEvidence')}</p>
          ) : (
            <ul className="space-y-3">
              {draft.evidence.map((entry, index) => (
                <li key={index} className="rounded-lg border border-rule p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <Label htmlFor={`ev-${index}-field`}>{t('editor.field')}</Label>
                      <Input
                        id={`ev-${index}-field`}
                        value={entry.field}
                        onChange={(event) =>
                          update({
                            evidence: draft.evidence.map((e, i) =>
                              i === index ? { ...e, field: event.target.value } : e,
                            ),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`ev-${index}-state`}>{t('evidence.reviewState')}</Label>
                      <Select
                        id={`ev-${index}-state`}
                        value={entry.reviewState}
                        onChange={(event) =>
                          update({
                            evidence: draft.evidence.map((e, i) =>
                              i === index
                                ? {
                                    ...e,
                                    reviewState: event.target
                                      .value as RecipeDraft['evidence'][number]['reviewState'],
                                  }
                                : e,
                            ),
                          })
                        }
                      >
                        {(['unreviewed', 'needs_review', 'confirmed', 'conflict'] as const).map(
                          (state) => (
                            <option key={state} value={state}>
                              {t(`evidence.${state}`)}
                            </option>
                          ),
                        )}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`ev-${index}-confidence`}>{t('evidence.confidence')}</Label>
                      <Input
                        id={`ev-${index}-confidence`}
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={entry.confidence}
                        onChange={(event) =>
                          update({
                            evidence: draft.evidence.map((e, i) =>
                              i === index ? { ...e, confidence: Number(event.target.value) } : e,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor={`ev-${index}-note`}>{t('recipe.notes')}</Label>
                      <Input
                        id={`ev-${index}-note`}
                        value={entry.notes[locale]}
                        onChange={(event) =>
                          update({
                            evidence: draft.evidence.map((e, i) =>
                              i === index
                                ? { ...e, notes: { ...e.notes, [locale]: event.target.value } }
                                : e,
                            ),
                          })
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('common.delete')}
                      onClick={() =>
                        update({ evidence: draft.evidence.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

/**
 * Warns before a browser-level navigation away from unsaved work. In-app
 * navigation is guarded separately by the Cancel button's confirmation.
 */
function useBeforeUnload(shouldWarn: () => boolean) {
  const handler = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!shouldWarn()) return
      event.preventDefault()
    },
    [shouldWarn],
  )

  useEffect(() => {
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [handler])
}
