'use client'

import { AlertTriangle, Check, CircleHelp, Loader2, Pencil } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'
import { resolveQuestionAction } from '@/app/actions/recipes'
import { AmountEditor } from '@/components/editor/amount-editor'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Input, Label, Select } from '@/components/ui/primitives'
import { Link } from '@/i18n/navigation'
import { type WireAmount, deserializeAmount } from '@/lib/data/serialize'
import type { DraftAmount } from '@/lib/data/recipe-draft'
import { formatAmount } from '@/lib/format'

export interface QuestionWire {
  id: string
  recipeSlug: string
  recipeName: string
  itemKey: string | null
  subject: string
  field: string
  reviewState: string
  note: string | null
  kind: 'amount' | 'yield' | 'ingredient' | 'other'
  currentAmount: WireAmount | null
}

export interface PackageOptionWire {
  id: string
  ingredientId: string
  ingredientName: string
  label: string | null
  netAmount: WireAmount
}

export function NeedsReviewList({
  questions,
  packageOptions,
}: {
  questions: QuestionWire[]
  packageOptions: PackageOptionWire[]
}) {
  const t = useTranslations()

  const grouped = useMemo(() => {
    const map = new Map<string, QuestionWire[]>()
    for (const question of questions) {
      const bucket = map.get(question.recipeSlug)
      if (bucket) bucket.push(question)
      else map.set(question.recipeSlug, [question])
    }
    return [...map.entries()]
  }, [questions])

  return (
    <div className="space-y-5">
      {grouped.map(([slug, group]) => (
        <section key={slug}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">
              {group[0]?.recipeName ?? slug}
            </h2>
            <Link href={`/recipes/${slug}/edit`}>
              <Button variant="ghost" size="sm">
                <Pencil aria-hidden />
                {t('review.openInEditor')}
              </Button>
            </Link>
          </div>

          <ul className="space-y-3">
            {group.map((question) => (
              <li key={question.id}>
                <QuestionCard question={question} packageOptions={packageOptions} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function QuestionCard({
  question,
  packageOptions,
}: {
  question: QuestionWire
  packageOptions: PackageOptionWire[]
}) {
  const t = useTranslations()
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState<DraftAmount>(() => {
    if (!question.currentAmount || question.currentAmount.kind === 'unknown') {
      return { kind: 'exact', value: '', unit: 'g' }
    }
    return question.currentAmount as DraftAmount
  })

  // Yield questions offer the real package sizes plus a free-form entry, so no
  // single size is ever presented as the answer.
  const relevantPackages = packageOptions.filter((option) =>
    question.kind === 'yield' ? true : option.ingredientId === question.itemKey,
  )
  const [yieldValue, setYieldValue] = useState('')
  const [yieldUnit, setYieldUnit] = useState('g')

  const title =
    question.kind === 'yield'
      ? t('review.questionYield', { subject: question.subject })
      : question.kind === 'ingredient'
        ? t('review.questionIngredient', { subject: question.subject })
        : question.kind === 'amount'
          ? t('review.questionAmount', { subject: question.subject })
          : t('review.questionOther', { subject: question.subject })

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await resolveQuestionAction({
        recipeSlug: question.recipeSlug,
        field: question.field,
        itemKey: question.itemKey,
        amount: question.kind === 'amount' ? amount : null,
        baseYield: question.kind === 'yield' ? yieldValue : null,
        yieldUnit: question.kind === 'yield' ? yieldUnit : null,
        confirm: true,
      })
      // Only report success when the write actually happened.
      if (result.ok) setDone(true)
      else setError(result.error)
    })
  }

  if (done) {
    return (
      <Card className="border-basil">
        <CardBody className="flex items-center gap-2 py-3 text-sm text-basil">
          <Check aria-hidden className="size-4" />
          {t('review.resolved')}
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium text-ink">{title}</p>
          <Badge tone={question.reviewState === 'conflict' ? 'accent' : 'warn'}>
            {question.reviewState === 'conflict' ? (
              <AlertTriangle aria-hidden className="size-3" />
            ) : (
              <CircleHelp aria-hidden className="size-3" />
            )}
            {t(`evidence.${question.reviewState}`)}
          </Badge>
        </div>

        {question.note ? <p className="text-sm text-ink-muted">{question.note}</p> : null}

        {question.kind === 'amount' ? (
          <AmountEditor idPrefix={`q-${question.id}`} value={amount} onChange={setAmount} />
        ) : null}

        {question.kind === 'yield' ? (
          <div className="space-y-2">
            {relevantPackages.length > 0 ? (
              <div>
                <Label htmlFor={`pkg-${question.id}`}>{t('review.packageSize')}</Label>
                <Select
                  id={`pkg-${question.id}`}
                  defaultValue=""
                  onChange={(event) => {
                    const option = relevantPackages.find((o) => o.id === event.target.value)
                    if (!option) return
                    const formatted = formatAmount(deserializeAmount(option.netAmount), locale)
                    setYieldValue(formatted.value?.replace(/\s/g, '').replace(',', '.') ?? '')
                    setYieldUnit(formatted.unit ?? 'g')
                  }}
                >
                  <option value="">{t('review.packageCustom')}</option>
                  {relevantPackages.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.ingredientName} — {option.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-ink-faint">{t('review.packageHint')}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`yield-${question.id}`}>{t('recipe.yield')}</Label>
                <Input
                  id={`yield-${question.id}`}
                  inputMode="decimal"
                  value={yieldValue}
                  onChange={(event) => setYieldValue(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`yieldunit-${question.id}`}>{t('settings.units')}</Label>
                <Select
                  id={`yieldunit-${question.id}`}
                  value={yieldUnit}
                  onChange={(event) => setYieldUnit(event.target.value)}
                >
                  {(['g', 'kg', 'ml', 'l', 'piece'] as const).map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`units.${unit}`, { count: 1 })}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        ) : null}

        {question.kind === 'ingredient' || question.kind === 'other' ? (
          <p className="text-sm text-ink-muted">
            <Link
              href={`/recipes/${question.recipeSlug}/edit`}
              className="text-tomato underline underline-offset-2"
            >
              {t('review.openInEditor')}
            </Link>
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-tomato">
            {error}
          </p>
        ) : null}

        {question.kind === 'amount' || question.kind === 'yield' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={submit}
              disabled={
                pending ||
                (question.kind === 'yield' && !yieldValue) ||
                (question.kind === 'amount' &&
                  amount.kind === 'exact' &&
                  !amount.value)
              }
            >
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
              {t('review.answer')}
            </Button>
            <Link href={`/recipes/${question.recipeSlug}`}>
              <Button variant="ghost" size="sm">
                {t('review.skip')}
              </Button>
            </Link>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
