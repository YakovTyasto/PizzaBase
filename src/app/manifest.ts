import type { MetadataRoute } from 'next'
import { appConfig } from '@/lib/config/app-config'

/**
 * The install manifest. Name and colours come from `appConfig`, so renaming the
 * product in one file renames the installed app too.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appConfig.name,
    short_name: appConfig.shortName,
    description: appConfig.tagline.en,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: appConfig.backgroundColor,
    theme_color: appConfig.themeColor,
    categories: ['food', 'lifestyle', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
