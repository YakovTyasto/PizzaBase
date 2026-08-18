import type { Page } from '@playwright/test'

/**
 * Deterministic control over the Notification API.
 *
 * `context.grantPermissions(['notifications'])` does not move
 * `Notification.permission` in headless Chromium -- it reports `denied` before
 * and after, whatever origin the grant names. So a suite that reads the real
 * API can only ever exercise one of the four states the app handles, and which
 * one that is depends on the browser build rather than on the test.
 *
 * These helpers install the API itself, before any page script runs, so each
 * state is chosen by the test rather than inherited from the environment. The
 * stub is a faithful one: `permission` is a real static, `requestPermission`
 * resolves to a configured outcome and updates `permission` the way a browser
 * does, and constructing a notification records what was shown -- which lets a
 * test assert that the app genuinely fired one, rather than only that it said
 * it would.
 */

export type NotificationPermission = 'default' | 'granted' | 'denied'

export interface ShownNotification {
  title: string
  body: string | null
  tag: string | null
}

declare global {
  interface Window {
    /** Everything the page passed to `new Notification(...)`. */
    __shownNotifications?: ShownNotification[]
    /** How many times the page asked for permission. */
    __permissionRequests?: number
  }
}

/**
 * Installs the Notification API in a known state.
 *
 * `onRequest` is what the browser would answer if the page asks, which is only
 * reachable from `default` -- exactly as in a real browser, where a second
 * prompt after a decision is never shown.
 */
export async function useNotificationApi(
  page: Page,
  options: { permission: NotificationPermission; onRequest?: NotificationPermission },
): Promise<void> {
  const { permission, onRequest = 'granted' } = options

  await page.addInitScript(
    ({ initial, answer }: { initial: string; answer: string }) => {
      window.__shownNotifications = []
      window.__permissionRequests = 0

      class StubNotification {
        static permission: string = initial

        static async requestPermission(): Promise<string> {
          window.__permissionRequests = (window.__permissionRequests ?? 0) + 1
          // A browser only prompts from `default`; once decided it answers
          // with the decision and shows nothing.
          if (StubNotification.permission === 'default') {
            StubNotification.permission = answer
          }
          return StubNotification.permission
        }

        constructor(title: string, init?: { body?: string; tag?: string }) {
          if (StubNotification.permission !== 'granted') {
            throw new Error('Notification permission has not been granted')
          }
          window.__shownNotifications?.push({
            title,
            body: init?.body ?? null,
            tag: init?.tag ?? null,
          })
        }

        close(): void {}
        addEventListener(): void {}
        removeEventListener(): void {}
      }

      Object.defineProperty(window, 'Notification', {
        value: StubNotification,
        configurable: true,
        writable: true,
      })
    },
    { initial: permission, answer: onRequest },
  )
}

/** Removes the Notification API entirely, as an older browser would have it. */
export async function withoutNotificationApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__shownNotifications = []
    window.__permissionRequests = 0
    // `delete window.Notification` is not enough: it is an own property of the
    // window in Chromium, and redefining it as undefined is what makes
    // `'Notification' in window` false the way an older browser has it.
    Reflect.deleteProperty(window, 'Notification')
  })
}

export function shownNotifications(page: Page): Promise<ShownNotification[]> {
  return page.evaluate(() => window.__shownNotifications ?? [])
}

export function permissionRequests(page: Page): Promise<number> {
  return page.evaluate(() => window.__permissionRequests ?? 0)
}

/** What the page currently reports, for asserting the stub actually took. */
export function reportedPermission(page: Page): Promise<string> {
  return page.evaluate(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
}
