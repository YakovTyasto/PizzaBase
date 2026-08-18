'use client'

/**
 * Local notifications, and an honest account of what they can do.
 *
 * A web app cannot promise a notification while it is closed. Per the Web Push
 * requirements, delivery to a closed app needs a push subscription and, on
 * iOS, the site installed to the home screen on 16.4 or later; Safari 16 on
 * macOS 13+ elsewhere. None of that is guaranteed for a visitor in a browser
 * tab.
 *
 * So this module does the thing that always works and says so: it fires a
 * notification from the page while the app is open, and the timer itself is
 * driven by an absolute end time, so closing the tab and coming back still
 * shows the right remaining time rather than a timer that quietly stopped.
 *
 * Everything degrades: denied permission, no Notification API at all, or a
 * browser that refuses -- the timers, the planner and the cooking screen
 * carry on unchanged, and the UI never claims a notification is coming.
 */

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationSupport(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as PermissionState
}

/**
 * Asks for permission.
 *
 * Only ever called from a click, because a permission prompt on page load is
 * both hostile and, in several browsers, silently refused.
 */
export async function requestPermission(): Promise<PermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission as PermissionState

  try {
    return (await Notification.requestPermission()) as PermissionState
  } catch {
    // Some browsers throw on the promise form in insecure contexts.
    return notificationSupport()
  }
}

export interface LocalNotice {
  title: string
  body: string
  tag: string
}

/**
 * Shows a notification if it can, and reports whether it did.
 *
 * The return value matters: the caller uses it to keep an in-page fallback
 * visible when nothing was shown, rather than assuming the notice landed.
 */
export function notify(notice: LocalNotice): boolean {
  if (notificationSupport() !== 'granted') return false

  try {
    // `tag` collapses repeats: a timer that fires while an older notice for
    // the same timer is still on screen replaces it instead of stacking.
    new Notification(notice.title, {
      body: notice.body,
      tag: notice.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
    return true
  } catch {
    return false
  }
}

/**
 * Whether the platform could deliver anything while the app is closed.
 *
 * Used to phrase the UI honestly rather than to gate the feature: on iOS this
 * is only true for a site installed to the home screen, which is exactly the
 * case where promising background delivery would otherwise be a lie.
 */
export function canDeliverInBackground(): boolean {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (!iOS) return true

  // iOS delivers push only to a home-screen installation.
  return window.matchMedia('(display-mode: standalone)').matches
}
