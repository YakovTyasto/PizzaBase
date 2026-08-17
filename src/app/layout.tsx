import type { ReactNode } from 'react'

/**
 * The `<html>` and `<body>` tags live in `[locale]/layout.tsx`, because the
 * `lang` attribute depends on the locale segment. This root layout only exists
 * to satisfy the App Router's requirement that `app/layout` be present.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
