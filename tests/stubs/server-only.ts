/**
 * Vitest stand-in for the `server-only` package.
 *
 * The real module throws when it is pulled into a client bundle. Tests run
 * outside any React Server Component graph, so the guard has nothing to
 * protect and would only prevent server modules from being tested at all.
 */
export {}
