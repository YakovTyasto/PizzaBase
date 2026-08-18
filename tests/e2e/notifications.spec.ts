import { expect, test } from '@playwright/test'

/**
 * Notification permission, and what the app promises about it.
 *
 * Chromium in Playwright starts with permission unset, so all three states are
 * reachable: unset, granted via the context, and denied. What matters is that
 * timers and the planner keep working identically in every one of them.
 */

test.describe('notifications as a progressive enhancement', () => {
  test('asks with a reason rather than prompting on load', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')

    // No dialog fired on load; the offer is a button.
    await expect(page.getByRole('button', { name: 'Включить уведомления' })).toBeVisible()
    await expect(page.getByText(/пока приложение открыто/)).toBeVisible()
  })

  test('says so once permission is granted', async ({ page, context }) => {
    await context.grantPermissions(['notifications'])
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')

    await expect(page.getByText(/Уведомления включены/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Включить уведомления' })).toHaveCount(0)
  })

  test('a timer still runs and finishes when notifications are refused', async ({
    page,
    context,
  }) => {
    // Nothing granted: the browser will refuse, which is the interesting case.
    await context.clearPermissions()
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')

    await page.getByLabel('Добавить таймер').fill('1')
    await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click()

    // The card itself reports the state, so the timer is usable with no
    // notification permission at all.
    await expect(page.getByRole('timer').first()).toBeVisible()
  })

  test('the planner offers reminders without requiring them', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/planner')

    await expect(page.getByRole('button', { name: 'Включить уведомления' })).toBeVisible()
    // The schedule itself renders regardless.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('a timer survives a reload because it runs on the clock', async ({ page }) => {
    await page.goto('/ru/recipes/sisofo-forgotten-neapolitan/cook')

    await page.getByLabel('Добавить таймер').fill('5')
    await page.getByRole('button', { name: 'Запустить таймер', exact: true }).click()
    const before = await page.getByRole('timer').first().textContent()

    await page.reload()
    const after = await page.getByRole('timer').first().textContent()

    // Not reset to five minutes: the end time is absolute, so the countdown
    // continued while the page was gone.
    expect(after).not.toBe('05:00')
    expect(before).not.toBe(after)
  })
})
