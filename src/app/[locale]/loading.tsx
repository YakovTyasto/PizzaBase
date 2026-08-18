/**
 * Route-level skeleton. Deliberately plain shapes rather than a spinner so the
 * page does not jump when content arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-4 py-4" aria-busy="true">
      <div className="bg-paper-sunken h-8 w-48 animate-pulse rounded" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="bg-paper-sunken h-40 animate-pulse rounded-[var(--radius-card)]"
          />
        ))}
      </div>
    </div>
  )
}
