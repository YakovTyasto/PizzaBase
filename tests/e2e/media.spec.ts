import { expect, test } from '@playwright/test'
import { pngFixture, textFixture } from './fixtures/png'

/**
 * Photos, end to end in demo mode.
 *
 * The bytes never reach the server here -- they are compressed in the browser
 * and kept in IndexedDB -- so these tests are also the proof that the local
 * path really persists rather than looking like it does until a reload.
 */

async function createRecipeWithPhoto(
  page: import('@playwright/test').Page,
  name: string,
  files: string[],
) {
  await page.goto('/ru/recipes/new?type=sauce')
  await page.getByLabel('Название').fill(name)

  await page.getByRole('tab', { name: 'Фотографии' }).click()
  await page.getByLabel('Добавить фотографии').setInputFiles(files)
  // Compression happens in the browser; wait for the card, not a timeout.
  await expect(page.getByRole('button', { name: 'Обложка' }).first()).toBeVisible({
    timeout: 30_000,
  })

  await page.getByRole('button', { name: 'Создать рецепт' }).click()
  await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
  return page.url()
}

test.describe('recipe photos', () => {
  test('uploads a photo and shows it on the recipe', async ({ page }) => {
    await createRecipeWithPhoto(page, 'Соус с фото', [pngFixture('one.png')])

    // An undescribed photo carries alt="", which makes it presentational --
    // so it is addressed as an element, not by the image role.
    const photo = page.locator('article figure img').first()
    await expect(photo).toBeVisible({ timeout: 20_000 })
    // A blob: URL is the proof the bytes came from IndexedDB, not the server.
    await expect(photo).toHaveAttribute('src', /^blob:/)
  })

  test('a photo survives a reload and a new page', async ({ page, context }) => {
    const url = await createRecipeWithPhoto(page, 'Стойкое фото', [pngFixture('two.png')])

    await page.reload()
    await expect(page.locator('article figure img').first()).toBeVisible({
      timeout: 20_000,
    })

    const second = await context.newPage()
    await second.goto(url)
    await expect(second.locator('article figure img').first()).toBeVisible({
      timeout: 20_000,
    })
    await second.close()
  })

  test('the cover appears on the library card', async ({ page }) => {
    await createRecipeWithPhoto(page, 'Соус для карточки', [pngFixture('three.png')])

    await page.goto('/ru/recipes')
    const card = page.locator('a', { hasText: 'Соус для карточки' }).first()
    await expect(card.locator('img').first()).toBeVisible({ timeout: 20_000 })
  })

  test('accepts several photos, reorders them and changes the cover', async ({ page }) => {
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Много фото')
    await page.getByRole('tab', { name: 'Фотографии' }).click()
    await page
      .getByLabel('Добавить фотографии')
      .setInputFiles([pngFixture('a.png'), pngFixture('b.png', 96)])

    await expect(page.getByRole('button', { name: 'Обложка' })).toHaveCount(2, { timeout: 30_000 })

    // The second photo becomes the cover, then moves to the front.
    await page.getByRole('button', { name: 'Обложка' }).nth(1).click()
    await expect(page.getByRole('button', { name: 'Обложка' }).nth(1)).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.getByRole('button', { name: 'Выше' }).nth(1).click()
    await expect(page.getByRole('button', { name: 'Обложка' }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.getByRole('button', { name: 'Создать рецепт' }).click()
    await expect(page).toHaveURL(/\/ru\/recipes\/[a-z0-9-]+$/, { timeout: 20_000 })
    await expect(page.locator('article figure img').first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('deletes a photo without touching the rest of the draft', async ({ page }) => {
    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByLabel('Название').fill('Соус без фото')
    await page.getByRole('tab', { name: 'Фотографии' }).click()
    await page.getByLabel('Добавить фотографии').setInputFiles([pngFixture('gone.png')])
    await expect(page.getByRole('button', { name: 'Обложка' })).toHaveCount(1, { timeout: 30_000 })

    await page.getByRole('button', { name: 'Удалить' }).first().click()
    await expect(page.getByText('Фотографий пока нет.')).toBeVisible()

    // The name typed before the upload is still there.
    await page.getByRole('tab', { name: 'Основное' }).click()
    await expect(page.getByLabel('Название')).toHaveValue('Соус без фото')
  })

  test('refuses a file that is not an image, and says why', async ({ page }) => {
    const notAnImage = textFixture('notes.txt', 'flour, water, salt')

    await page.goto('/ru/recipes/new?type=sauce')
    await page.getByRole('tab', { name: 'Фотографии' }).click()
    await page.getByLabel('Добавить фотографии').setInputFiles([notAnImage])

    await expect(page.getByRole('alert').first()).toContainText('JPEG', { timeout: 20_000 })
    await expect(page.getByText('Фотографий пока нет.')).toBeVisible()
  })

  test('resetting demo data removes the photos too', async ({ page }) => {
    await createRecipeWithPhoto(page, 'Временное фото', [pngFixture('temp.png')])

    const before = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open('impasto-media', 1)
          request.onsuccess = () => {
            const db = request.result
            const count = db.transaction('blobs').objectStore('blobs').count()
            count.onsuccess = () => resolve(count.result)
          }
          request.onerror = () => resolve(-1)
        }),
    )
    expect(before).toBeGreaterThan(0)

    await page.goto('/ru/settings')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Сбросить демо-данные' }).click()
    await expect(page.getByText('Демо-данные сброшены.')).toBeVisible({ timeout: 20_000 })

    const after = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const request = indexedDB.open('impasto-media', 1)
          request.onsuccess = () => {
            const db = request.result
            const count = db.transaction('blobs').objectStore('blobs').count()
            count.onsuccess = () => resolve(count.result)
          }
          request.onerror = () => resolve(-1)
        }),
    )
    expect(after).toBe(0)
  })
})
