import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The scanning pipeline's order of attempts.
 *
 * Reading the code says barcode comes first; these tests make it a property
 * that cannot be quietly reversed. The expensive, uncertain source must never
 * run when the cheap, authoritative one already answered.
 */

const lookupByBarcode = vi.fn()
const recognizeProduct = vi.fn()
const visionStatus = { name: 'OpenAI vision', available: true, requiredKey: 'OPENAI_API_KEY' }

vi.mock('@/lib/providers/registry', () => ({
  getProductLookupProvider: () => ({
    status: { name: 'Open Food Facts', available: true, requiredKey: null },
    lookupByBarcode,
  }),
  getVisionProvider: () => ({ status: visionStatus, recognizeProduct }),
}))

vi.mock('@/lib/limits/caller', () => ({ callerKey: async () => 'test-owner' }))

const { lookupBarcodeAction, recognizeImageAction } = await import('./scan')
const { resetRateLimits } = await import('@/lib/limits/rate')

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimits()
  visionStatus.available = true
})

describe('barcode first', () => {
  it('answers from the product database without touching vision', async () => {
    lookupByBarcode.mockResolvedValue({
      displayName: 'Pelati',
      brand: 'Mutti',
      netQuantity: { value: '400', unit: 'g' },
      ingredientsText: null,
      allergens: [],
      barcode: '8001234567890',
      sourceUrl: 'https://world.openfoodfacts.org/product/8001234567890',
      confidence: 0.9,
    })

    const result = await lookupBarcodeAction('8001234567890')

    expect(result.ok).toBe(true)
    // The whole point of the ordering: no paid call was made.
    expect(recognizeProduct).not.toHaveBeenCalled()
  })

  it('records where the answer came from, so the screen can say', async () => {
    lookupByBarcode.mockResolvedValue({
      displayName: 'Pelati',
      brand: null,
      netQuantity: null,
      ingredientsText: null,
      allergens: [],
      barcode: '8001234567890',
      sourceUrl: null,
      confidence: 0.8,
    })

    const result = await lookupBarcodeAction('8001234567890')
    expect(result.ok && result.result.source).toBe('barcode')
    expect(result.ok && result.result.confidence).toBe(0.8)
  })

  it('refuses something that is not a barcode before any lookup', async () => {
    const result = await lookupBarcodeAction('not-a-barcode')

    expect(result.ok).toBe(false)
    expect(lookupByBarcode).not.toHaveBeenCalled()
  })

  it('says the product is unknown rather than falling through to vision', async () => {
    lookupByBarcode.mockResolvedValue(null)

    const result = await lookupBarcodeAction('8001234567890')
    expect(result.ok).toBe(false)
    expect(recognizeProduct).not.toHaveBeenCalled()
  })
})

describe('vision as the fallback', () => {
  function imageForm(bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]), type = 'image/jpeg') {
    const form = new FormData()
    form.append('image', new File([bytes], 'label.jpg', { type }))
    return form
  }

  it('reads the label when there was no barcode to read', async () => {
    recognizeProduct.mockResolvedValue({
      displayName: 'Pelati',
      brand: null,
      netQuantity: null,
      ocrText: 'POMODORI PELATI',
      likelyIngredientSlug: null,
      confidence: 0.5,
    })

    const result = await recognizeImageAction(imageForm())
    expect(result.ok).toBe(true)
    expect(recognizeProduct).toHaveBeenCalledOnce()
  })

  it('refuses a file type it will not send to a paid API', async () => {
    const result = await recognizeImageAction(imageForm(new Uint8Array([1, 2]), 'application/pdf'))

    expect(result.ok).toBe(false)
    expect(recognizeProduct).not.toHaveBeenCalled()
  })

  it('names the missing key instead of failing silently', async () => {
    visionStatus.available = false

    const result = await recognizeImageAction(imageForm())
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.requiredKey).toBe('OPENAI_API_KEY')
    expect(recognizeProduct).not.toHaveBeenCalled()
  })

  it('stops calling once the caller has had their share', async () => {
    recognizeProduct.mockResolvedValue({
      displayName: null,
      brand: null,
      netQuantity: null,
      ocrText: null,
      likelyIngredientSlug: null,
      confidence: 0.1,
    })

    const { AI_LIMITS } = await import('@/lib/limits/rate')
    for (let i = 0; i < AI_LIMITS.vision!.limit; i += 1) {
      await recognizeImageAction(imageForm())
    }
    const calls = recognizeProduct.mock.calls.length

    const refused = await recognizeImageAction(imageForm())
    expect(refused.ok).toBe(false)
    // A stuck retry loop cannot keep spending.
    expect(recognizeProduct.mock.calls.length).toBe(calls)
  })
})
