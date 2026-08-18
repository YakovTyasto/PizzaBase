import { expect, test } from '@playwright/test'
import {
  permissionRequests,
  reportedPermission,
  shownNotifications,
  useNotificationApi,
  withoutNotificationApi,
} from './notification-api'

/**
 * Notification permission, and what the app promises about it.
 *
 * The app handles four states -- unset, granted, refused, and no API at all --
 * and the promise it makes differs in each. Headless Chromium reports `denied`
 * whatever the context grants, so the state is installed per test rather than
 * inherited; see `notification-api.ts` for why and how.
 *
 * What has to hold in every one of them: the timers and the planner work
 * unchanged, and the UI never claims a notification is coming when it is not.
 */

const COOK = '/ru/recipes/sisofo-forgotten-neapolitan/cook'
const PLANNER = '/ru/recipes/sisofo-forgotten-neapolitan/planner'

const enableButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Включить уведомления' })

test.describe('permission not yet asked for', () => {
  test.beforeEach(async ({ page }) => {
    await useNotificationApi(page, { permission: 'default' })
  })

  test('asks with a reason rather than prompting on load', async ({ page }) => {
    await page.goto(COOK)
    await expect(reportedPermission(page)).resolves.toBe('default')

    // The offer is a button, and nothing has been asked for yet.
    await expect(enableButton(page)).toBeVisible()
    await expect(
      page.getByText(/Уведомления .* пока приложение открыто|пока приложение открыто/),
    ).toBeVisible()
    expect(await permissionRequests(page)).toBe(0)
  })

  test('asks only when the button is pressed, and then says it is on', async ({ page }) => {
    await page.goto(COOK)

    await enableButton(page).click()

    expect(await permissionRequests(page)).toBe(1)
    await expect(page.getByText(/Уведомления включены/)).toBeVisible()
    await expect(enableButton(page)).toHaveCount(0)
  })

  test('accepts a refusal without breaking anything', async ({ page }) => {
    await useNotificationApi(page, { permission: 'default', onRequest: 'denied' })
    await page.goto(COOK)

    await enableButton(page).click()

    await expect(page.getByText(/Уведомления отключены в браузере/)).toBeVisible()
    await expect(enableButton(page)).toHaveCount(0)
    // The refusal is explained, and the rest of the screen is untouched.
    await expect(page.getByText(/Шаг 1 из/)).toBeVisible()
  })

  test('the planner offers reminders without requiring them', async ({ page }) => {
    await page.goto(PLANNER)

    await expect(enableButton(page)).toBeVisible()
    // The schedule itself renders regardless.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByLabel('Когда хотите есть?')).toBeVisible()
  })
})

test.describe('permission granted', () => {
  test.beforeEach(async ({ page }) => {
    await useNotificationApi(page, { permission: 'granted' })
  })

  test('says so, and stops offering', async ({ page }) => {
    await page.goto(COOK)
    await expect(reportedPermission(page)).resolves.toBe('granted')

    await expect(page.getByText(/Уведомления включены/)).toBeVisible()
    await expect(enableButton(page)).toHaveCount(0)
  })

  test('actually fires a notification when a timer finishes', async ({ page }) => {
    // Installed before the page loads, so the countdown and the app's own
    // one-second tick share this clock rather than the wall clock.
    await page.clock.install()
    await page.goto(COOK)

    await page.getByLabel('Добавить таймер').fill('1')
    await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click()
    await expect(page.getByRole('timer').first()).toBeVisible()

    // Past the end, rather than sleeping for a minute.
    await page.clock.runFor('01:05')

    await expect
      .poll(async () => (await shownNotifications(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(0)

    const [notice] = await shownNotifications(page)
    expect(notice?.title).toContain('Таймер завершён')
    // Tagged, so a repeat replaces the notice rather than stacking on it.
    expect(notice?.tag).toBeTruthy()
  })
})

test.describe('permission refused', () => {
  test.beforeEach(async ({ page }) => {
    await useNotificationApi(page, { permission: 'denied' })
  })

  test('explains that the browser refused, and offers nothing', async ({ page }) => {
    await page.goto(COOK)
    await expect(reportedPermission(page)).resolves.toBe('denied')

    await expect(page.getByText(/Уведомления отключены в браузере/)).toBeVisible()
    // No button: pressing it could not produce a prompt, so offering one lies.
    await expect(enableButton(page)).toHaveCount(0)
  })

  test('a timer still runs and finishes', async ({ page }) => {
    await page.clock.install()
    await page.goto(COOK)

    await page.getByLabel('Добавить таймер').fill('1')
    await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click()
    await expect(page.getByRole('timer').first()).toBeVisible()

    await page.clock.runFor('01:05')

    // Nothing was shown -- and the card itself reports the finish, so the fact
    // is not lost with the notification.
    await expect(page.getByText('Таймер закончился')).toBeVisible()
    expect(await shownNotifications(page)).toHaveLength(0)
  })

  test('the planner still schedules', async ({ page }) => {
    await page.goto(PLANNER)

    await expect(page.getByText(/Уведомления отключены в браузере/)).toBeVisible()
    await expect(page.getByLabel('Когда хотите есть?')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('no Notification API at all', () => {
  test.beforeEach(async ({ page }) => {
    await withoutNotificationApi(page)
  })

  test('says the browser cannot do it, and carries on', async ({ page }) => {
    await page.goto(COOK)
    await expect(reportedPermission(page)).resolves.toBe('unsupported')

    await expect(page.getByText(/не поддерживает уведомления/)).toBeVisible()
    await expect(enableButton(page)).toHaveCount(0)
  })

  test('a timer runs with no API present', async ({ page }) => {
    await page.clock.install()
    await page.goto(COOK)

    await page.getByLabel('Добавить таймер').fill('1')
    await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click()
    await expect(page.getByRole('timer').first()).toBeVisible()

    await page.clock.runFor('01:05')

    // Reaching zero must not throw on the missing constructor.
    await expect(page.getByText('Таймер закончился')).toBeVisible()
    expect(await shownNotifications(page)).toHaveLength(0)
  })
})

test.describe('timers do not depend on permission', () => {
  for (const permission of ['default', 'granted', 'denied'] as const) {
    test(`survives a reload with permission "${permission}"`, async ({ page }) => {
      await useNotificationApi(page, { permission })
      await page.goto(COOK)

      await page.getByLabel('Добавить таймер').fill('5')
      await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click()
      const before = await page.getByRole('timer').first().textContent()
      expect(before).toBe('5:00')

      // A second of real time, so the absolute end time is demonstrably in the
      // past relative to where it started.
      await page.waitForTimeout(1200)
      await page.reload()

      const after = await page.getByRole('timer').first().textContent()
      // Not reset to five minutes: the end time is absolute, so the countdown
      // continued while the page was gone.
      expect(after).not.toBe('5:00')
      expect(after).not.toBe(before)
    })
  }
})
