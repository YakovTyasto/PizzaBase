import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/primitives'
import { appConfig } from '@/lib/config/app-config'
import { isDemoMode } from '@/lib/config/env'
import { BottomNav } from './bottom-nav'
import { LocaleSwitcher } from './locale-switcher'
import { OfflineIndicator } from './offline-indicator'
import { Sidebar } from './sidebar'
import { SyncStatus } from '@/components/offline/sync-status'

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations()
  const demo = isDemoMode()

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <a
          href="#main"
          className="focus:bg-ink focus:text-paper sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:px-3 focus:py-2"
        >
          {t('nav.skipToContent')}
        </a>

        <header className="border-rule bg-paper/90 sticky top-0 z-30 border-b backdrop-blur">
          <div className="page-shell flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-display truncate text-lg font-semibold lg:hidden">
                {appConfig.name}
              </span>
              {demo ? (
                <Badge tone="warn" title={t('app.demoExplain')}>
                  {t('app.demoBadge')}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <OfflineIndicator />
              <LocaleSwitcher />
            </div>
          </div>
        </header>

        {/* pb-24 keeps content clear of the fixed bottom bar on phones. */}
        <main id="main" className="page-shell flex-1 pt-5 pb-24 lg:pb-10">
          {/* Anything saved offline and still waiting is shown above the page
              rather than buried, so it cannot be mistaken for saved. */}
          <div className="mb-4 empty:mb-0">
            <SyncStatus />
          </div>
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
