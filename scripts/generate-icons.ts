/**
 * Renders the PWA icon set from one inline SVG.
 *
 * Run with `npx tsx scripts/generate-icons.ts` after changing the mark. Sharp
 * ships with Next.js, so this adds no dependency of its own.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { appConfig } from '../src/lib/config/app-config'

const OUT_DIR = path.join(process.cwd(), 'public', 'icons')

/**
 * A wheat grain over a warm ground: the mark reads at 32 px, which a detailed
 * pizza illustration would not. `inset` leaves the safe area maskable icons
 * need so Android does not crop the glyph.
 */
function markSvg(size: number, inset: number, background: string): string {
  const s = size
  const scale = (1 - inset * 2) / 100
  const shift = size * inset

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${background}"/>
  <g transform="translate(${shift} ${shift}) scale(${s * scale})">
    <g fill="none" stroke="#B3372A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M50 8 C50 8 34 26 34 48 C34 68 50 92 50 92 C50 92 66 68 66 48 C66 26 50 8 50 8 Z"/>
      <path d="M50 20 L50 84"/>
      <path d="M50 36 L38 46"/>
      <path d="M50 36 L62 46"/>
      <path d="M50 56 L38 66"/>
      <path d="M50 56 L62 66"/>
    </g>
  </g>
</svg>`
}

async function render(name: string, size: number, inset: number, background: string) {
  const svg = markSvg(size, inset, background)
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()
  await writeFile(path.join(OUT_DIR, name), buffer)
  return `${name} (${size}x${size})`
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const light = appConfig.backgroundColor

  const written = await Promise.all([
    render('icon-192.png', 192, 0.16, light),
    render('icon-512.png', 512, 0.16, light),
    // Maskable icons need ~20% padding so the safe zone is never clipped.
    render('icon-maskable-512.png', 512, 0.26, light),
    render('apple-touch-icon.png', 180, 0.14, light),
  ])

  for (const line of written) console.log(`wrote public/icons/${line}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
