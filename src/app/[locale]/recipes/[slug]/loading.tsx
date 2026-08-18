/**
 * Loading UI for a recipe page.
 *
 * The route-level skeleton one level up is shaped like the library grid, which
 * is wrong here and, on a slow response, left the main region looking empty
 * while the page streamed in. This one has the shape of a recipe -- badges,
 * title, the scaler card, an ingredient list -- so the layout does not jump
 * when the real content arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-6 py-1" aria-busy="true">
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <div className="bg-paper-sunken h-5 w-16 animate-pulse rounded-full" />
          <div className="bg-paper-sunken h-5 w-24 animate-pulse rounded-full" />
        </div>
        <div className="bg-paper-sunken h-9 w-3/4 max-w-lg animate-pulse rounded" />
        <div className="bg-paper-sunken h-4 w-full max-w-2xl animate-pulse rounded" />
        <div className="flex flex-wrap gap-2 pt-1">
          {[0, 1, 2].map((index) => (
            <div key={index} className="bg-paper-sunken h-11 w-32 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>

      <div className="border-rule bg-paper-raised rounded-[var(--radius-card)] border p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="bg-paper-sunken h-11 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>

      <div className="border-rule bg-paper-raised space-y-3 rounded-[var(--radius-card)] border p-4 sm:p-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="bg-paper-sunken h-5 animate-pulse rounded" />
        ))}
      </div>
    </div>
  )
}
