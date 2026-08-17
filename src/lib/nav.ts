import {
  BadgeAlert,
  BookOpen,
  CalendarClock,
  ChefHat,
  Download,
  History,
  Home,
  Refrigerator,
  ScanLine,
  Settings,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react'

export interface NavItem {
  href: string
  /** Key under the `nav` namespace in the message catalogs. */
  labelKey: string
  icon: typeof Home
}

/** The five destinations in the mobile bottom bar. */
export const primaryNav: NavItem[] = [
  { href: '/', labelKey: 'home', icon: Home },
  { href: '/recipes', labelKey: 'recipes', icon: BookOpen },
  { href: '/plan', labelKey: 'plan', icon: CalendarClock },
  { href: '/pantry', labelKey: 'pantry', icon: Refrigerator },
  { href: '/import', labelKey: 'import', icon: Download },
]

/** Everything else, reachable from the sidebar and the profile menu. */
export const secondaryNav: NavItem[] = [
  { href: '/review', labelKey: 'review', icon: BadgeAlert },
  { href: '/shopping', labelKey: 'shopping', icon: ShoppingBasket },
  { href: '/recommendations', labelKey: 'recommendations', icon: Sparkles },
  { href: '/scan', labelKey: 'scanner', icon: ScanLine },
  { href: '/history', labelKey: 'history', icon: History },
  { href: '/settings', labelKey: 'settings', icon: Settings },
]

export const cookIcon = ChefHat

/**
 * Whether a nav entry should read as current. The root is matched exactly so
 * that `/recipes` does not light up Home as well.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
