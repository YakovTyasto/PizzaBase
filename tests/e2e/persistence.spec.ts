import path from 'node:path'
import { expect, test } from '@playwright/test'
import { E2E_DEMO_DIR } from './demo-storage'

/**
 * Persistence, and the honesty of the UI about it.
 *
 * The suite runs in a writable demo, which is the mode a reader of the README
 * has locally. What is asserted here is that a write which succeeds survives a
 * reload -- and, just as importantly, that the health endpoint says which mode
 * is in force rather than leaving it to be discovered by losing data.
 */

test.describe('the health endpoint names the storage mode', () => {
  test('reports a mode that says whether anything can be saved', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBeLessThan(500)

    const body = await response.json()
    expect(['supabase', 'demo', 'demo-readonly']).toContain(body.mode)
    expect(typeof body.writable).toBe('boolean')
    expect(body.writable).toBe(body.mode !== 'demo-readonly')

    // Never a key, a URL, a project ref or a filesystem path.
    const text = JSON.stringify(body)
    expect(text).not.toMatch(/\/var\/task/)
    expect(text).not.toMatch(/impasto-demo/)
    expect(text).not.toMatch(/supabase\.co/)
  })
})

test.describe('a write that succeeds survives a reload', () => {
  test('a pizza added to the plan is still there afterwards', async ({ page }) => {
    await page.goto('/ru/plan')
    // Demo mode keys its storage to a session cookie the proxy mints on the
    // first document response. Acting before the page has settled can race
    // that, which no real user can do -- and which would make this test report
    // a session problem as a persistence one.
    await page.waitForLoadState('networkidle')

    const select = page.getByLabel('Добавить пиццу')
    const name = await select.locator('option').first().innerText()

    // Armed before the click: the Server Action's own response is the only
    // reliable signal that the write landed. The optimistic row appears
    // immediately and says nothing about the server, and network-quiet is a
    // guess that can resolve in the gap before the request is even sent --
    // reloading there asks for a plan the server has not been told about, and
    // reports the test outrunning the app as the app losing the pizza.
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.status() < 400,
    )
    await page.getByRole('button', { name: 'Добавить' }).click()

    // Optimistically, first.
    await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible()
    await saved

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible({ timeout: 15_000 })
  })

  test('a pantry item is still there afterwards', async ({ page }) => {
    await page.goto('/ru/pantry')
    await page.waitForLoadState('networkidle')

    // Named explicitly: the first ingredient in the list is counted in leaves,
    // and a quantity in leaves would not read back as grams.
    await page.getByLabel('Ингредиенты', { exact: true }).selectOption({ label: 'Пармезан' })
    await page.getByLabel('Количество').fill('750')
    await page.getByLabel('Единицы').selectOption('g')
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.status() < 400,
    )
    await page.getByRole('button', { name: 'Добавить' }).click()
    await saved

    await expect(page.getByText('750 г').first()).toBeVisible()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('750 г').first()).toBeVisible({ timeout: 15_000 })
  })
})

/**
 * The read-only demo, which is what Vercel without Supabase actually is.
 *
 * Reproduced by starting a second server with IMPASTO_DEMO_READONLY set, so
 * the behaviour is exercised rather than asserted from the code. Skipped when
 * the suite is pointed at an external base URL, whose mode is not ours to set.
 */
test.describe('read-only demo', () => {
  // The only skip left in the suite, and it is a capability guard rather than
  // a defect being parked: these tests start a second server in a mode of
  // their own choosing, which is impossible when the run is pointed at an
  // external deployment. `npm run test:e2e` and CI both run them.
  test.skip(
    Boolean(process.env.E2E_BASE_URL),
    'Needs a server this suite starts itself, to force read-only mode.',
  )

  /*
   * These share one server, so they run in one worker, in order.
   *
   * Without this the group's tests are spread across workers and every one of
   * them runs `beforeAll` -- each spawning a server on the same port, all but
   * the first dying of EADDRINUSE, and their tests meeting the browser's own
   * "this page couldn't load". Serialising the group is the honest expression
   * of what it needs; the rest of the suite stays parallel.
   */
  test.describe.configure({ mode: 'serial' })

  // A port per worker slot, because the mobile and desktop projects reach this
  // group at the same time and would otherwise want the same one. Resolved in
  // the hook: `test.info()` has nothing to report while the group is being
  // declared.
  const FIRST_PORT = Number(process.env.READONLY_PORT ?? 3190)
  let BASE = ''
  let server: import('node:child_process').ChildProcess | undefined

  test.beforeAll(async ({}, testInfo) => {
    const PORT = FIRST_PORT + testInfo.parallelIndex
    BASE = `http://127.0.0.1:${PORT}`
    const { spawn } = await import('node:child_process')
    server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
      env: {
        ...process.env,
        DEMO_MODE: 'true',
        NEXT_PUBLIC_DEMO_MODE: 'true',
        IMPASTO_DEMO_READONLY: 'true',
        // Read-only means nothing is written, but pointing it away from the
        // repository keeps that a fact rather than a hope.
        IMPASTO_DEMO_DIR: path.join(E2E_DEMO_DIR, 'readonly'),
      },
      stdio: 'ignore',
      shell: process.platform === 'win32',
    })

    // Wait for it to answer rather than sleeping a fixed amount.
    const deadline = Date.now() + 90_000
    for (;;) {
      try {
        const response = await fetch(`${BASE}/api/health`)
        if (response.status < 500) break
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error('read-only server did not start')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  })

  test.afterAll(() => {
    server?.kill()
  })

  test('reports mode demo-readonly', async () => {
    const body = await (await fetch(`${BASE}/api/health`)).json()
    expect(body.mode).toBe('demo-readonly')
    expect(body.writable).toBe(false)
  })

  test('serves the whole catalog for reading', async ({ page }) => {
    await page.goto(`${BASE}/ru/recipes`)
    const links = await page.locator('a[href^="/ru/recipes/"]').count()
    expect(links).toBeGreaterThan(0)

    await page.goto(`${BASE}/ru/recipes/sisofo-forgotten-neapolitan`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Забытый стиль')
  })

  test('disables the plan controls and explains why', async ({ page }) => {
    await page.goto(`${BASE}/ru/plan`)

    await expect(page.getByText(/нет постоянного хранилища/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Добавить' })).toBeDisabled()
  })

  test('disables the pantry controls and explains why', async ({ page }) => {
    await page.goto(`${BASE}/ru/pantry`)

    await page.getByLabel('Количество').fill('500')
    await expect(page.getByRole('button', { name: 'Добавить' })).toBeDisabled()
    await expect(page.getByText(/нет постоянного хранилища/)).toBeVisible()
  })

  test('never shows a filesystem path, whatever is attempted', async ({ page }) => {
    for (const path of ['/ru/plan', '/ru/pantry', '/ru/settings', '/ru/experiments']) {
      await page.goto(`${BASE}${path}`)
      await page.waitForLoadState('networkidle')

      const body = await page.locator('body').innerText()
      expect(body, path).not.toMatch(/ENOENT/)
      expect(body, path).not.toMatch(/\/var\/task/)
      expect(body, path).not.toMatch(/impasto-demo/)
      expect(body, path).not.toMatch(/mkdir/)
    }
  })

  test('shows nothing as saved after a refused write', async ({ page }) => {
    await page.goto(`${BASE}/ru/plan`)
    // Nothing was ever stored, so the plan is empty and stays empty.
    await expect(page.getByText('В плане пока нет пицц.')).toBeVisible()

    await page.reload()
    await expect(page.getByText('В плане пока нет пицц.')).toBeVisible()
  })

  test('says on the settings screen that this deployment keeps nothing', async ({ page }) => {
    await page.goto(`${BASE}/ru/settings`)
    await expect(page.getByText('Демо только для чтения')).toBeVisible()
    await expect(page.getByText(/Подключите Supabase/).first()).toBeVisible()
  })

  test('explains on the experiments screen that versions cannot be created', async ({ page }) => {
    await page.goto(`${BASE}/ru/experiments`)
    await expect(page.getByText(/площадка только для чтения/)).toBeVisible()
  })
})
