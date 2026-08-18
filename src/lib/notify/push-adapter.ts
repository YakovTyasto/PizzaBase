import 'server-only'

/**
 * Server push, as an adapter with nothing behind it yet.
 *
 * Delivering a notification to a closed app needs a push subscription, a pair
 * of VAPID keys and a service that signs and sends -- and on iOS it needs the
 * site installed to the home screen on 16.4 or later. That is a real feature
 * with real operational cost, so it is not switched on by default and no paid
 * service is assumed.
 *
 * What exists here is the seam: a documented interface, an honest disabled
 * implementation, and the environment variables a future one would read. The
 * app never pretends a background notification is coming; the UI copy is
 * written from `canDeliverInBackground`, not from hope.
 *
 * To implement one:
 *   1. Generate a VAPID key pair and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
 *      and VAPID_SUBJECT (a mailto: or https: contact URL).
 *   2. Store subscriptions per owner -- a table with an RLS policy like every
 *      other owned row.
 *   3. Replace `DisabledPushProvider` with one that signs and posts to each
 *      subscription's endpoint.
 */

export interface PushSubscriptionRecord {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PushProvider {
  readonly status: { name: string; available: boolean; requiredKey: string | null }
  send(
    subscription: PushSubscriptionRecord,
    payload: { title: string; body: string; tag: string },
  ): Promise<void>
}

class DisabledPushProvider implements PushProvider {
  readonly status = { name: 'Web Push', available: false, requiredKey: 'VAPID_PUBLIC_KEY' }

  async send(): Promise<void> {
    throw new Error('Web Push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.')
  }
}

export function getPushProvider(): PushProvider {
  // Deliberately unconditional for now: reading the keys and returning a
  // half-implemented sender would be worse than saying it is not built.
  return new DisabledPushProvider()
}

/** Whether the deployment has been given what a push sender would need. */
export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}
