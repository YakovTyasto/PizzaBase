'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { useNow } from '@/components/cooking/timers'
import { notify } from '@/lib/notify/local'
import { NotificationOptIn } from './notification-opt-in'

export interface Stage {
  id: string
  at: Date
  label: string
}

/**
 * Reminders for a fermentation schedule.
 *
 * The schedule is a list of absolute times, which is the whole point: a stage
 * that came due while the tab was closed is still visibly due when the page
 * comes back, because nothing here depends on a timer having been running.
 * The notification only announces the moment to someone who is looking away.
 */
export function StageReminders({ stages }: { stages: Stage[] }) {
  const t = useTranslations()
  const now = useNow(stages.length > 0)
  const announced = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const stage of stages) {
      if (announced.current.has(stage.id)) continue

      const due = stage.at.getTime()
      // Only stages that came due while this page was open. Announcing
      // everything already in the past on load would be noise, not a reminder.
      if (due > now || now - due > 60_000) continue

      announced.current.add(stage.id)
      notify({
        title: t('notify.stageDue'),
        body: t('notify.stageBody', {
          label: stage.label,
          time: stage.at.toLocaleTimeString(),
        }),
        tag: `stage-${stage.id}`,
      })
    }
  }, [stages, now, t])

  return <NotificationOptIn compact />
}
