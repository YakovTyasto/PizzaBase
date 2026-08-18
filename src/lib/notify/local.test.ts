// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canDeliverInBackground, notificationSupport, notify, requestPermission } from './local'

/** Replaces the Notification API for one test. */
function withNotification(
  permission: NotificationPermission,
  options: { request?: () => Promise<NotificationPermission>; construct?: () => void } = {},
) {
  class FakeNotification {
    static permission = permission
    static requestPermission = options.request ?? (async () => permission)
    constructor() {
      options.construct?.()
    }
  }
  vi.stubGlobal('Notification', FakeNotification)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('when the browser has no Notification API', () => {
  it('reports it as unsupported rather than pretending', () => {
    vi.stubGlobal('Notification', undefined)
    // jsdom has no Notification; deleting it is the honest simulation.
    Reflect.deleteProperty(window, 'Notification')
    expect(notificationSupport()).toBe('unsupported')
  })

  it('asking for permission resolves to unsupported instead of throwing', async () => {
    Reflect.deleteProperty(window, 'Notification')
    await expect(requestPermission()).resolves.toBe('unsupported')
  })

  it('showing one reports that nothing was shown', () => {
    Reflect.deleteProperty(window, 'Notification')
    expect(notify({ title: 'Timer', body: 'Done', tag: 't' })).toBe(false)
  })
})

describe('when permission was denied', () => {
  it('does not ask again', async () => {
    const request = vi.fn(async () => 'denied' as NotificationPermission)
    withNotification('denied', { request })

    expect(await requestPermission()).toBe('denied')
    // Re-prompting a user who said no is what gets a site permanently blocked.
    expect(request).not.toHaveBeenCalled()
  })

  it('shows nothing and says so', () => {
    const construct = vi.fn()
    withNotification('denied', { construct })

    expect(notify({ title: 'Timer', body: 'Done', tag: 't' })).toBe(false)
    expect(construct).not.toHaveBeenCalled()
  })
})

describe('when permission is granted', () => {
  it('shows the notification and reports success', () => {
    const construct = vi.fn()
    withNotification('granted', { construct })

    expect(notify({ title: 'Timer', body: 'Done', tag: 't' })).toBe(true)
    expect(construct).toHaveBeenCalledOnce()
  })

  it('reports failure when the browser refuses to construct one', () => {
    withNotification('granted', {
      construct: () => {
        throw new Error('not allowed')
      },
    })
    // The caller keeps its in-page fallback visible on a false.
    expect(notify({ title: 'Timer', body: 'Done', tag: 't' })).toBe(false)
  })
})

describe('when permission has not been asked for', () => {
  it('asks, and returns what the user chose', async () => {
    const request = vi.fn(async () => 'granted' as NotificationPermission)
    withNotification('default', { request })

    expect(await requestPermission()).toBe('granted')
    expect(request).toHaveBeenCalledOnce()
  })

  it('survives a browser that throws instead of resolving', async () => {
    withNotification('default', {
      request: () => {
        throw new Error('insecure context')
      },
    })
    await expect(requestPermission()).resolves.toBe('default')
  })
})

describe('what the platform can promise', () => {
  /** jsdom has neither, so both have to be supplied to test the real branch. */
  function withPushCapableBrowser(userAgent: string, standalone: boolean) {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('matchMedia', () => ({ matches: standalone }))
  }

  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
  const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0)'

  it('claims nothing without a push manager', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    Reflect.deleteProperty(window, 'PushManager')
    expect(canDeliverInBackground()).toBe(false)
  })

  it('claims nothing without a service worker', () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    vi.stubGlobal('PushManager', class {})
    expect(canDeliverInBackground()).toBe(false)
  })

  it('does not promise background delivery on iOS in a browser tab', () => {
    withPushCapableBrowser(IPHONE, false)
    // iOS delivers push only to a home-screen installation.
    expect(canDeliverInBackground()).toBe(false)
  })

  it('allows it for an installed iOS app', () => {
    withPushCapableBrowser(IPHONE, true)
    expect(canDeliverInBackground()).toBe(true)
  })

  it('allows it elsewhere without requiring an installation', () => {
    withPushCapableBrowser(DESKTOP, false)
    expect(canDeliverInBackground()).toBe(true)
  })
})
