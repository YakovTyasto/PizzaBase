'use client'

import { Camera, Check, Info, Loader2, ScanLine, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { type ScanResult, lookupBarcodeAction, recognizeImageAction } from '@/app/actions/scan'
import { addPantryItemAction } from '@/app/actions/pantry'
import { rememberPackageAction } from '@/app/actions/packages'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardBody, Input, Label, Select } from '@/components/ui/primitives'
import type { Unit } from '@/domain'
import { useBarcodeDetectorSupported } from '@/lib/client-env'
import { ImageRejectedError, prepareImage } from '@/lib/media/compress'

/**
 * Package scanner.
 *
 * The barcode is read in the browser with `BarcodeDetector` when it exists, so
 * the common case costs nothing and sends no image anywhere. Only when there is
 * no barcode -- or no detector -- does an image go to the server, and even then
 * the API key never leaves it.
 *
 * The result is always shown for review before it becomes a pantry entry, and
 * it is labelled with where the data came from.
 */
export function ProductScanner({
  ingredients,
  visionAvailable,
  visionRequiredKey,
}: {
  ingredients: { id: string; name: string; baseUnit: Unit }[]
  visionAvailable: boolean
  visionRequiredKey: string | null
}) {
  const t = useTranslations()
  const [pending, startTransition] = useTransition()

  const [barcode, setBarcode] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const detectorSupported = useBarcodeDetectorSupported()
  const [saved, setSaved] = useState(false)

  // Review fields the user can correct before anything is saved.
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<Unit>('g')
  const [rememberPackage, setRememberPackage] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const applyResult = (next: ScanResult) => {
    setResult(next)
    setSaved(false)
    if (next.netQuantity) {
      setQuantity(next.netQuantity.value)
      const parsedUnit = next.netQuantity.unit.toLowerCase()
      if (['mg', 'g', 'kg', 'ml', 'l'].includes(parsedUnit)) setUnit(parsedUnit as Unit)
    }
    // Best-effort match against the catalog by name; never auto-confirmed.
    const guess = ingredients.find((ingredient) =>
      next.displayName?.toLowerCase().includes(ingredient.name.toLowerCase()),
    )
    if (guess) setIngredientId(guess.id)
  }

  const runBarcode = (code: string) => {
    setError(null)
    startTransition(async () => {
      const response = await lookupBarcodeAction(code)
      if (response.ok) applyResult(response.result)
      else setError(response.error)
    })
  }

  /** Tries the in-browser detector first, then falls back to the server. */
  const handleFile = async (file: File) => {
    setError(null)

    if (detectorSupported) {
      try {
        const DetectorCtor = (
          window as unknown as {
            BarcodeDetector: new (options?: { formats?: string[] }) => {
              detect(source: ImageBitmap): Promise<{ rawValue: string }[]>
            }
          }
        ).BarcodeDetector
        const detector = new DetectorCtor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
        })
        const bitmap = await createImageBitmap(file)
        const codes = await detector.detect(bitmap)
        bitmap.close()
        const found = codes[0]?.rawValue
        if (found) {
          setBarcode(found)
          runBarcode(found)
          return
        }
      } catch {
        // Detection failed; fall through to the server path.
      }
    }

    if (!visionAvailable) {
      setError(
        `${t('scanner.noBarcode')}. ${t('errors.providerDisabledHint', {
          key: visionRequiredKey ?? 'OPENAI_API_KEY',
        })}`,
      )
      return
    }

    startTransition(async () => {
      try {
        // Shrunk before it reaches a paid API. A phone photo of a label is
        // 8 MB and reads no better than the 200 KB version, and the
        // re-encode drops the EXIF -- including where the shot was taken.
        const prepared = await prepareImage(file)
        const formData = new FormData()
        formData.append('image', new File([prepared.blob], 'label.jpg', { type: prepared.type }))

        const response = await recognizeImageAction(formData)
        if (response.ok) applyResult(response.result)
        else setError(response.error)
      } catch (cause) {
        setError(
          cause instanceof ImageRejectedError
            ? t(`media.reject.${cause.reason}`)
            : t('errors.generic'),
        )
      }
    })
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      const response = await addPantryItemAction({
        ingredientId,
        quantity,
        unit,
        location: 'pantry',
      })
      if (!response.ok) {
        setError(response.error)
        return
      }

      // Remembering the package size is what turns "how big is the can?" from
      // a permanent open question into one the owner has already answered.
      if (rememberPackage && quantity) {
        const remembered = await rememberPackageAction({
          ingredientId,
          label: result?.displayName ?? result?.brand ?? `${quantity} ${unit}`,
          value: quantity,
          unit,
          barcode: result?.barcode ?? null,
        })
        if (!remembered.ok) {
          // The pantry write already succeeded, so this is reported without
          // pretending the whole save failed.
          setError(remembered.error)
        }
      }

      setSaved(true)
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div>
            <Label htmlFor="barcode">{t('scanner.barcodeFound', { code: '' })}</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                inputMode="numeric"
                placeholder="8001234567890"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
              />
              <Button onClick={() => runBarcode(barcode)} disabled={pending || !barcode}>
                {pending ? <Loader2 aria-hidden className="animate-spin" /> : <ScanLine aria-hidden />}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
              <Camera aria-hidden />
              {t('scanner.startCamera')}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
              <Upload aria-hidden />
              {t('scanner.uploadPhoto')}
            </Button>
          </div>

          <p className="text-xs text-ink-faint">
            {detectorSupported ? t('scanner.scanning') : t('scanner.usingOcr')}
          </p>

          {!visionAvailable && visionRequiredKey ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t('errors.providerDisabledHint', { key: visionRequiredKey })}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {error ? (
        <p role="alert" className="rounded-lg bg-tomato-soft px-3 py-2 text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}

      {result ? (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">{t('scanner.review')}</h2>
              <span className="flex gap-1.5">
                <Badge tone="neutral">
                  {t('scanner.dataSource')}:{' '}
                  {result.source === 'barcode'
                    ? t('scanner.sourceBarcode')
                    : result.source === 'ocr'
                      ? t('scanner.sourceOcr')
                      : t('scanner.sourceVision')}
                </Badge>
                <Badge tone="outline">
                  {t('scanner.confidence')} {Math.round(result.confidence * 100)}%
                </Badge>
              </span>
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{t('scanner.productName')}</dt>
                <dd className="text-right font-medium text-ink">
                  {result.displayName ?? t('common.unknown')}
                </dd>
              </div>
              {result.brand ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{t('scanner.brand')}</dt>
                  <dd className="text-right text-ink">{result.brand}</dd>
                </div>
              ) : null}
              {result.allergens.length > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Allergens</dt>
                  <dd className="text-right text-ink">{result.allergens.join(', ')}</dd>
                </div>
              ) : null}
            </dl>

            {/* Every field stays editable: the scan is a proposal, not a fact. */}
            <div className="grid gap-3 border-t border-rule pt-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label htmlFor="scan-ingredient">{t('scanner.canonicalIngredient')}</Label>
                <Select
                  id="scan-ingredient"
                  value={ingredientId}
                  onChange={(event) => setIngredientId(event.target.value)}
                >
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="scan-quantity">{t('scanner.netQuantity')}</Label>
                <Input
                  id="scan-quantity"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="scan-unit">{t('settings.units')}</Label>
                <Select
                  id="scan-unit"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as Unit)}
                >
                  {(['g', 'kg', 'ml', 'l', 'piece'] as const).map((code) => (
                    <option key={code} value={code}>
                      {t(`units.${code}`, { count: 1 })}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {result.sourceUrl ? (
              <a
                href={result.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-tomato underline underline-offset-2"
              >
                {t('recipe.openSource')}
              </a>
            ) : null}

            <p className="text-xs text-ink-faint">{t('scanner.keepImageHint')}</p>

            {quantity ? (
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={rememberPackage}
                  onChange={(event) => setRememberPackage(event.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--color-tomato)]"
                />
                <span>
                  {t('scanner.rememberPackage')}
                  <span className="block text-xs text-ink-faint">
                    {t('scanner.rememberPackageHint')}
                  </span>
                </span>
              </label>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={pending || !quantity || !ingredientId}>
                <Check aria-hidden />
                {t('scanner.addToPantry')}
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                {t('common.cancel')}
              </Button>
            </div>

            {saved ? (
              <p className="text-sm text-basil" role="status">
                {t('pantry.title')} · {t('common.save')}d
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
