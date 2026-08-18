'use client'

import { AlertTriangle, CloudUpload, Loader2, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import { saveRecipeAction } from '@/app/actions/recipes'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody } from '@/components/ui/primitives'
import { useRouter } from '@/i18n/navigation'
import { useOffline } from '@/lib/client-env'
import {
  type QueueEntry,
  clearSynced,
  flushQueue,
  listQueue,
  removeEntry,
  subscribeToQueue,
} from '@/lib/offline/queue'

/**
 * Shows what is waiting to sync and drives the replay.
 *
 * A conflict is never resolved silently: the entry stays parked with the local
 * copy intact and the owner is asked which side wins.
 */
/** Stable empty snapshot so the server render never allocates a new array. */
const EMPTY: QueueEntry[] = []
const emptyQueue = () => EMPTY

export function SyncStatus() {
  const t = useTranslations()
  const offline = useOffline()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // The queue lives in local storage, which is an external store: reading it
  // through useSyncExternalStore avoids both a hydration mismatch and the
  // cascading render a state-setting effect would cause.
  const entries = useSyncExternalStore(subscribeToQueue, listQueue, emptyQueue)
  const [, forceRefresh] = useState(0)
  const refresh = useCallback(() => forceRefresh((n) => n + 1), [])

  const flush = useCallback(() => {
    startTransition(async () => {
      const result = await flushQueue({
        'recipe-draft': async (payload, idempotencyKey) => {
          // The key makes a replay safe: if this draft already reached the
          // server on an earlier attempt whose response was lost, the save
          // resolves to that recipe instead of creating a second one.
          const saved = await saveRecipeAction(payload, idempotencyKey)
          return saved.ok ? { ok: true } : { ok: false, error: saved.error }
        },
        // Cooking progress already lives in local storage and is replayed by
        // the cooking screen itself; nothing to send here yet.
        'cook-session': async () => ({ ok: true }),
      })
      refresh()
      // The page the owner is looking at was rendered before the replay
      // landed, so it is showing a library without the recipe that just
      // synced. Ask for it again rather than leaving a stale view.
      if (result.synced > 0) router.refresh()
    })
  }, [refresh, router])

  // 'syncing' counts as still waiting: the write has not landed yet, and a
  // badge that disappeared the moment a replay started would be claiming the
  // change was saved while the request was still in flight.
  const waiting = entries.filter(
    (entry) =>
      entry.status === 'pending' || entry.status === 'failed' || entry.status === 'syncing',
  )

  // Replay automatically: once when a page loads with something already
  // queued, and again whenever the connection comes back.
  //
  // The attempt is latched, because a queue that is still waiting *because the
  // replay just failed* would otherwise re-trigger this effect forever. The
  // latch is released by going offline, and the Retry button covers the rest.
  const attempted = useRef(false)
  useEffect(() => {
    if (offline) {
      attempted.current = false
      return
    }
    if (attempted.current || waiting.length === 0) return
    attempted.current = true
    flush()
  }, [offline, waiting.length, flush])
  const conflicts = entries.filter((entry) => entry.status === 'conflict')

  if (waiting.length === 0 && conflicts.length === 0) return null

  return (
    <Card className={conflicts.length > 0 ? 'border-tomato' : undefined}>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm text-ink">
            <CloudUpload aria-hidden className="size-4" />
            {t('sync.queued', { count: waiting.length })}
          </span>
          <Badge tone={offline ? 'warn' : 'neutral'}>
            {offline ? t('common.offline') : t('sync.pending')}
          </Badge>
        </div>

        {conflicts.length > 0 ? (
          <div className="space-y-2">
            <p className="flex items-start gap-2 text-sm text-tomato-strong">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t('sync.conflictHint')}
            </p>
            {conflicts.map((entry) => (
              <div key={entry.id} className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Keeping the server copy simply drops the local entry.
                    removeEntry(entry.id)
                    refresh()
                  }}
                >
                  {t('sync.discardLocal')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    startTransition(async () => {
                      await saveRecipeAction(entry.payload, entry.idempotencyKey)
                      removeEntry(entry.id)
                      refresh()
                    })
                  }}
                >
                  {t('sync.keepLocal')}
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {!offline && waiting.length > 0 ? (
          <Button variant="outline" size="sm" onClick={flush} disabled={pending}>
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <RefreshCw aria-hidden />
            )}
            {t('sync.retry')}
          </Button>
        ) : null}

        {entries.some((entry) => entry.status === 'synced') ? (
          <button
            type="button"
            onClick={() => {
              clearSynced()
              refresh()
            }}
            className="text-xs text-ink-faint underline underline-offset-2"
          >
            {t('sync.synced')}
          </button>
        ) : null}
      </CardBody>
    </Card>
  )
}
