'use client'

import { AlertTriangle, Check, FlaskConical, Loader2, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { saveExperimentAction } from '@/app/actions/experiments'
import { makeVersionPrimaryAction } from '@/app/actions/versions'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Input, Select, Textarea } from '@/components/ui/primitives'
import { useRouter } from '@/i18n/navigation'
import type { ParameterRow } from '@/lib/data/experiment'
import { cn } from '@/lib/utils'

export interface VersionOption {
  id: string
  label: string
  isPrimary: boolean
}

/**
 * Building one comparison.
 *
 * The table is computed on the server from the versions the owner picked and
 * arrives finished; this only chooses which versions to compare and records
 * what the owner concluded. Nothing summarises the numbers on its own.
 */
export function ExperimentWorkbench({
  recipeSlug,
  versions,
  selectedIds,
  rows,
  existing,
}: {
  recipeSlug: string
  versions: VersionOption[]
  selectedIds: string[]
  rows: ParameterRow[]
  existing: {
    id: string
    title: string
    hypothesis: string | null
    conclusion: string | null
    winningVersionId: string | null
  } | null
}) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [title, setTitle] = useState(existing?.title ?? '')
  const [hypothesis, setHypothesis] = useState(existing?.hypothesis ?? '')
  const [conclusion, setConclusion] = useState(existing?.conclusion ?? '')
  const [winner, setWinner] = useState(existing?.winningVersionId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const changed = rows.filter((row) => row.changed)
  const unchanged = rows.filter((row) => !row.changed)

  const setSelection = (index: number, id: string) => {
    const next = [...selectedIds]
    next[index] = id
    router.replace(`/experiments?recipe=${recipeSlug}&versions=${next.join(',')}`)
  }

  const save = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await saveExperimentAction({
        id: existing?.id ?? null,
        recipeSlug,
        title: title.trim(),
        versionIds: selectedIds,
        sessionIds: [],
        hypothesis: hypothesis.trim() || null,
        conclusion: conclusion.trim() || null,
        winningVersionId: winner || null,
      })
      if (result.ok) setSaved(true)
      else setError(result.error)
    })
  }

  const promote = () => {
    if (!winner) return
    if (!window.confirm(t('versions.restoreConfirm'))) return
    startTransition(async () => {
      const result = await makeVersionPrimaryAction(winner)
      // Making a version primary keeps the one it replaced, so nothing is lost
      // by declaring a winner and changing your mind later.
      if (result.ok) router.push(`/recipes/${recipeSlug}`)
      else setError(result.error ?? t('errors.generic'))
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedIds.map((id, index) => (
              <label key={index} className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                  {t('experiments.slot', { number: index + 1 })}
                </span>
                <Select value={id} onChange={(event) => setSelection(index, event.target.value)}>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.label}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>

          {selectedIds.length < 4 && versions.length > selectedIds.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const unused = versions.find((version) => !selectedIds.includes(version.id))
                if (unused) setSelection(selectedIds.length, unused.id)
              }}
            >
              {t('experiments.addVersion')}
            </Button>
          ) : null}
        </CardBody>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {t('experiments.whatChanged')}
        </h2>
        <Card>
          <CardBody className="p-0 sm:p-0">
            {changed.length === 0 ? (
              <p className="px-4 py-3 text-sm text-basil">{t('experiments.identical')}</p>
            ) : (
              <ComparisonTable rows={changed} selectedIds={selectedIds} versions={versions} />
            )}
          </CardBody>
        </Card>
      </section>

      {unchanged.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm text-ink-muted">
            {t('experiments.showUnchanged', { count: unchanged.length })}
          </summary>
          <Card className="mt-2">
            <CardBody className="p-0 sm:p-0">
              <ComparisonTable rows={unchanged} selectedIds={selectedIds} versions={versions} />
            </CardBody>
          </Card>
        </details>
      ) : null}

      <Card>
        <CardBody className="space-y-3">
          <div>
            <label htmlFor="exp-title" className="mb-1.5 block text-xs font-medium text-ink-muted">
              {t('experiments.name')}
            </label>
            <Input
              id="exp-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('experiments.namePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="exp-hyp" className="mb-1.5 block text-xs font-medium text-ink-muted">
              {t('experiments.hypothesis')}
            </label>
            <Textarea
              id="exp-hyp"
              rows={2}
              value={hypothesis}
              onChange={(event) => setHypothesis(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="exp-con" className="mb-1.5 block text-xs font-medium text-ink-muted">
              {t('experiments.conclusion')}
            </label>
            <Textarea
              id="exp-con"
              rows={2}
              value={conclusion}
              onChange={(event) => setConclusion(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="exp-win" className="mb-1.5 block text-xs font-medium text-ink-muted">
              {t('experiments.winner')}
            </label>
            <Select
              id="exp-win"
              value={winner}
              onChange={(event) => setWinner(event.target.value)}
            >
              <option value="">{t('experiments.noWinner')}</option>
              {selectedIds.map((id) => (
                <option key={id} value={id}>
                  {versions.find((version) => version.id === id)?.label ?? id}
                </option>
              ))}
            </Select>
          </div>

          {error ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-tomato">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={pending}>
              {pending ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <FlaskConical aria-hidden />
              )}
              {t('experiments.save')}
            </Button>

            {winner ? (
              <Button variant="outline" onClick={promote} disabled={pending}>
                <Trophy aria-hidden />
                {t('experiments.promote')}
              </Button>
            ) : null}
          </div>

          {saved ? (
            <p role="status" className="flex items-center gap-2 text-sm text-basil">
              <Check aria-hidden className="size-4" />
              {t('experiments.savedConfirm')}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}

function ComparisonTable({
  rows,
  selectedIds,
  versions,
}: {
  rows: ParameterRow[]
  selectedIds: string[]
  versions: VersionOption[]
}) {
  const t = useTranslations()

  return (
    // Wide tables scroll in their own box; the page never does.
    <div className="scroll-x">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="px-4 py-2 font-medium text-ink-muted">
              {t('experiments.parameter')}
            </th>
            {selectedIds.map((id) => (
              <th key={id} scope="col" className="px-4 py-2 font-medium text-ink-muted">
                {versions.find((version) => version.id === id)?.label ?? id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                {t(`experiments.param.${row.key}`)}
              </th>
              {row.values.map((value, index) => (
                <td
                  key={index}
                  className={cn(
                    'tabular px-4 py-2',
                    row.changed ? 'font-medium text-tomato-strong' : 'text-ink-faint',
                  )}
                >
                  {value ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ExperimentBadge({ changed }: { changed: number }) {
  const t = useTranslations()
  return <Badge tone={changed > 0 ? 'warn' : 'good'}>{t('experiments.changed', { count: changed })}</Badge>
}
