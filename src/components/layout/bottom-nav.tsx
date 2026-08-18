'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { isActivePath, primaryNav } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** Mobile-first bottom bar. Hidden on large screens in favour of the sidebar. */
export function BottomNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  return (
    <nav
      aria-label={t('menu')}
      className="border-rule bg-paper-raised/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {primaryNav.map((entry) => {
          const active = isActivePath(pathname, entry.href)
          const Icon = entry.icon
          return (
            <li key={entry.href} className="flex-1">
              <Link
                href={entry.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem] font-medium transition-colors',
                  active ? 'text-tomato' : 'text-ink-faint hover:text-ink',
                )}
              >
                <Icon aria-hidden className="size-5" />
                <span className="truncate">{t(entry.labelKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
