'use client'

import { useTranslations } from 'next-intl'
import { appConfig } from '@/lib/config/app-config'
import { Link, usePathname } from '@/i18n/navigation'
import { isActivePath, primaryNav, secondaryNav } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** Compact desktop sidebar. Replaces the bottom bar from `lg` up. */
export function Sidebar() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  const renderGroup = (items: typeof primaryNav) =>
    items.map((entry) => {
      const active = isActivePath(pathname, entry.href)
      const Icon = entry.icon
      return (
        <li key={entry.href}>
          <Link
            href={entry.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-tomato-soft text-tomato-strong'
                : 'text-ink-muted hover:bg-paper-sunken hover:text-ink',
            )}
          >
            <Icon aria-hidden className="size-4.5 shrink-0" />
            <span className="truncate">{t(entry.labelKey)}</span>
          </Link>
        </li>
      )
    })

  return (
    <aside className="hidden w-56 shrink-0 border-r border-rule px-3 py-6 lg:block">
      <div className="px-3 pb-6">
        <Link href="/" className="font-display text-xl font-semibold text-ink">
          {appConfig.name}
        </Link>
      </div>
      <nav aria-label={t('menu')}>
        <ul className="space-y-1">{renderGroup(primaryNav)}</ul>
        <hr className="my-4 border-0 border-t border-rule" />
        <ul className="space-y-1">{renderGroup(secondaryNav)}</ul>
      </nav>
    </aside>
  )
}
