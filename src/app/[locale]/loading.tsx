/**
 * Route-level skeleton. Deliberately plain shapes rather than a spinner so the
 * page does not jump when content arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-4 py-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-paper-sunken" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-[var(--radius-card)] bg-paper-sunken"
          />
        ))}
      </div>
    </div>
  )
}
