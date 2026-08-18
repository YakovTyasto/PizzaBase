import { ACCEPTED_IMAGE_TYPES, type AcceptedImageType } from './types'

/**
 * Identifies an image by its actual bytes.
 *
 * A browser-reported MIME type is a claim, not a fact: it comes from the file
 * extension on most platforms and is trivially wrong or forged. Everything
 * that decides whether to accept, store or hand a file to a paid API checks
 * the magic bytes instead, on the server as well as in the browser.
 */
export function sniffImageType(bytes: Uint8Array): AcceptedImageType | null {
  if (bytes.length < 12) return null

  // FF D8 FF -- JPEG (SOI + first marker)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'

  // 89 50 4E 47 0D 0A 1A 0A -- PNG
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (png.every((byte, index) => bytes[index] === byte)) return 'image/png'

  // "RIFF" .... "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46]
  const webp = [0x57, 0x45, 0x42, 0x50]
  if (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[8 + index] === byte)
  ) {
    return 'image/webp'
  }

  return null
}

/** True when the bytes look like HEIC/HEIF, which no browser decodes reliably. */
export function looksLikeHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  // ISO-BMFF: [size][ftyp][brand]
  const ftyp = [0x66, 0x74, 0x79, 0x70]
  if (!ftyp.every((byte, index) => bytes[4 + index] === byte)) return false

  const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)
  return ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'mif1', 'msf1'].includes(brand)
}

export function extensionFor(type: AcceptedImageType): string {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp'
}

export function isAcceptedImageType(value: string): value is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(value)
}
