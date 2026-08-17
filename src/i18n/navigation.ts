import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Locale-aware replacements for next/link and the navigation hooks. Import
 * these instead of the next/navigation originals so links keep their locale.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
