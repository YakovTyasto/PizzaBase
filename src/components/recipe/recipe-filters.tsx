'use client'

import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/primitives'
import { usePathname, useRouter } from '@/i18n/navigation'
import type { LocalizedText } from '@/lib/data/types'

const TYPES = ['pizza', 'dough', 'sauce', 'prep'] as const
const CLASSES = [
  'traditional',
  'pizzaiolo',
  'modern_italian',
  'adapted',
  'experimental',
  'user_verified',
] as const
const STATUSES = ['draft', 'needs_review', 'verified'] as const

/**
 * Filter bar. Every choice is written into the query string rather than local
 * state, so the URL is the single source of truth and a filtered library can be
 * bookmarked or shared.
 */
export function RecipeFilters({
  styles,
  ovens,
}: {
  styles: { id: string; name: LocalizedText }[]
  ovens: { id: string; name: LocalizedText }[]
}) {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const urlQuery = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)

  // Keep the box in step when the URL changes from elsewhere (the back button,
  // a shared link). Adjusting state during render is React's documented way to
  // react to a changed input -- an effect here would cost an extra render pass.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    setSearch(urlQuery)
  }

  const apply = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`)
    })
  }

  // Debounce typing so each keystroke does not push a history entry.
  useEffect(() => {
    if (search === urlQuery) return
    const handle = setTimeout(() => apply('q', search || null), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlQuery])

  const hasAny = [...searchParams.keys()].length > 0

  const selectFor = (
    key: string,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <Select
        aria-label={label}
        value={searchParams.get(key) ?? ''}
        onChange={(event) => apply(key, event.target.value || null)}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )

  return (
    <div className={pending ? 'opacity-70 transition-opacity' : undefined}>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('recipes.searchPlaceholder')}
          aria-label={t('common.search')}
          className="pl-9"
        />
      </div>

      {/* Filters wrap into a grid rather than forming an intrinsically-wide
          scroll strip. A row of five dropdowns at max-content width widens the
          mobile layout viewport even inside an overflow container, and a
          sideways-scrolling strip of selects is awkward on a phone anyway. */}
      <div className="mt-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {selectFor(
            'type',
            t('recipes.filterType'),
            TYPES.map((value) => ({ value, label: t(`recipeType.${value}`) })),
          )}
          {selectFor(
            'class',
            t('recipes.filterAuthenticity'),
            CLASSES.map((value) => ({ value, label: t(`authenticity.${value}`) })),
          )}
          {selectFor(
            'status',
            t('recipes.filterStatus'),
            STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
          )}
          {selectFor(
            'style',
            t('recipes.filterStyle'),
            styles.map((style) => ({ value: style.id, label: style.name.value })),
          )}
          {selectFor(
            'oven',
            t('recipes.filterOven'),
            ovens.map((oven) => ({ value: oven.id, label: oven.name.value })),
          )}
          {hasAny ? (
            <Button
              variant="ghost"
              size="sm"
              className="col-span-2 sm:col-span-1"
              onClick={() => startTransition(() => router.replace(pathname))}
            >
              <X aria-hidden className="size-4" />
              {t('common.clear')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
