'use client'

import { AlertTriangle, Check, Languages, Loader2, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { type FieldProposal, translateFieldsAction } from '@/app/actions/translate'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Select } from '@/components/ui/primitives'
import type { RecipeDraft } from '@/lib/data/recipe-draft'
import { cn } from '@/lib/utils'

const LOCALES = ['ru', 'en', 'fr'] as const
type Loc = (typeof LOCALES)[number]

interface Field {
  path: string
  label: string
  source: string
  current: string
  context?: 'recipe_name' | 'step' | 'note'
}

/**
 * Translating the fields the owner picks, with a review step.
 *
 * Nothing is written until the diff has been looked at. A proposal that
 * changed a figure is shown struck through and cannot be applied at all --
 * the guard is in the action, and this only reports its verdict. An existing
 * translation someone typed by hand is left alone unless overwriting is
 * explicitly ticked.
 */
export function TranslatePanel({
  draft,
  onApply,
}: {
  draft: RecipeDraft
  onApply: (updates: { path: string; text: string }[]) => void
}) {
  const t = useTranslations()
  const [pending, startTransition] = useTransition()
  const [target, setTarget] = useState<Loc>(draft.originLocale === 'ru' ? 'en' : 'ru')
  const [overwrite, setOverwrite] = useState(false)
  const [proposals, setProposals] = useState<FieldProposal[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [requiredKey, setRequiredKey] = useState<string | null>(null)

  const from = draft.originLocale as Loc

  const fields = collectFields(draft, from, target)
  const translatable = fields.filter(
    (field) => field.source.trim() && (overwrite || !field.current.trim()),
  )

  const run = () => {
    setError(null)
    setRequiredKey(null)
    setProposals(null)

    startTransition(async () => {
      const result = await translateFieldsAction({
        from,
        to: target,
        fields: translatable.map((field) => ({
          path: field.path,
          text: field.source,
          context: field.context,
        })),
      })

      if (!result.ok) {
        setError(result.error)
        setRequiredKey(result.requiredKey ?? null)
        return
      }

      setProposals(result.proposals)
      // Only the proposals that passed the guard start selected.
      setChosen(new Set(result.proposals.filter((p) => p.status === 'ok').map((p) => p.path)))
    })
  }

  const apply = () => {
    if (!proposals) return
    const updates = proposals
      .filter((proposal) => proposal.status === 'ok' && chosen.has(proposal.path))
      .map((proposal) => ({
        path: `${proposal.path}.${target}`,
        text: (proposal as { text: string }).text,
      }))
    onApply(updates)
    setProposals(null)
  }

  const labelFor = (path: string) => fields.find((field) => field.path === path)?.label ?? path
  const sourceFor = (path: string) => fields.find((field) => field.path === path)?.source ?? ''

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-40 flex-1">
            <span className="text-ink-muted mb-1.5 block text-xs font-medium">
              {t('translate.target')}
            </span>
            <Select
              value={target}
              onChange={(event) => {
                setTarget(event.target.value as Loc)
                setProposals(null)
              }}
            >
              {LOCALES.filter((locale) => locale !== from).map((locale) => (
                <option key={locale} value={locale}>
                  {t(`locale.${locale}`)}
                </option>
              ))}
            </Select>
          </label>

          <Button onClick={run} disabled={pending || translatable.length === 0}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Languages aria-hidden />}
            {t('translate.run', { count: translatable.length })}
          </Button>
        </div>

        <label className="text-ink flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(event) => {
              setOverwrite(event.target.checked)
              setProposals(null)
            }}
            className="mt-0.5 size-4 accent-[var(--color-tomato)]"
          />
          <span>
            {t('translate.overwrite')}
            <span className="text-ink-faint block text-xs">{t('translate.overwriteHint')}</span>
          </span>
        </label>

        <p className="text-ink-faint text-xs">{t('translate.scope')}</p>

        {error ? (
          <p
            role="alert"
            className="bg-amber-soft text-amber flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {error}
              {requiredKey ? (
                <span className="block">
                  {t('errors.providerDisabledHint', { key: requiredKey })}
                </span>
              ) : null}
              <span className="block">{t('translate.manualFallback')}</span>
            </span>
          </p>
        ) : null}

        {proposals ? (
          proposals.length === 0 ? (
            <p className="text-ink-muted text-sm">{t('translate.nothing')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                {t('translate.review')}
              </p>

              <ul className="divide-rule divide-y">
                {proposals.map((proposal) => (
                  <li key={proposal.path} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-ink text-sm font-medium">
                        {labelFor(proposal.path)}
                      </span>
                      {proposal.status === 'ok' ? (
                        <label className="text-ink-muted flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={chosen.has(proposal.path)}
                            onChange={(event) => {
                              const next = new Set(chosen)
                              if (event.target.checked) next.add(proposal.path)
                              else next.delete(proposal.path)
                              setChosen(next)
                            }}
                            className="size-4 accent-[var(--color-tomato)]"
                          />
                          {t('translate.apply')}
                        </label>
                      ) : (
                        <Badge tone="warn">
                          <ShieldAlert aria-hidden className="size-3" />
                          {t('translate.refused')}
                        </Badge>
                      )}
                    </div>

                    <p className="text-ink-faint mt-1 text-sm">{sourceFor(proposal.path)}</p>
                    <p
                      className={cn(
                        'text-sm',
                        proposal.status === 'ok' ? 'text-ink' : 'text-tomato-strong line-through',
                      )}
                    >
                      {proposal.status === 'failed' ? proposal.reason : proposal.text}
                    </p>

                    {proposal.status === 'refused' ? (
                      <p className="text-tomato mt-0.5 text-xs">
                        {t('translate.refusedHint', { detail: proposal.reason })}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>

              <Button size="sm" onClick={apply} disabled={chosen.size === 0}>
                <Check aria-hidden />
                {t('translate.applySelected', { count: chosen.size })}
              </Button>
            </div>
          )
        ) : null}
      </CardBody>
    </Card>
  )
}

/**
 * The fields that can be translated.
 *
 * Ingredient rows are absent on purpose: they carry an ingredient id, and the
 * name comes from the catalog's own translations. Translating them here would
 * be how a second spelling of "mozzarella" gets into a shopping list.
 */
function collectFields(draft: RecipeDraft, from: Loc, to: Loc): Field[] {
  const fields: Field[] = [
    {
      path: 'names',
      label: 'name',
      source: draft.names[from],
      current: draft.names[to],
      context: 'recipe_name',
    },
    {
      path: 'summaries',
      label: 'summary',
      source: draft.summaries[from],
      current: draft.summaries[to],
      context: 'note',
    },
    {
      path: 'notes',
      label: 'notes',
      source: draft.notes[from],
      current: draft.notes[to],
      context: 'note',
    },
  ]

  draft.steps.forEach((step, index) => {
    fields.push({
      path: `steps.${index}.instructions`,
      label: `step ${index + 1}`,
      source: step.instructions[from],
      current: step.instructions[to],
      context: 'step',
    })
    if (step.cues) {
      fields.push({
        path: `steps.${index}.cues`,
        label: `step ${index + 1} cues`,
        source: step.cues[from],
        current: step.cues[to],
        context: 'step',
      })
    }
  })

  return fields
}
