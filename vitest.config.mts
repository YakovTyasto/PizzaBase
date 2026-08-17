import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside a React Server Component graph. Under
      // Vitest the guard has nothing to protect, so it resolves to a no-op.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    // Default to node; component tests opt in with a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
})
