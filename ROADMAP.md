# Roadmap

Where the project actually stands, and what comes next. Nothing here is
aspirational filler — the "not yet built" section lists real gaps.

## Built and working

**The calculation engine.** Decimal-safe units, four amount shapes, nested
recipe expansion with cycle detection and provenance, area-based size scaling,
baker's percentages, pantry deduction, package rounding, backward fermentation
scheduling, and deterministic recommendation ranking. 139 unit tests.

**Demo mode.** The whole app runs with no database and no API keys. Pantry,
plan, cooking sessions and settings persist per browser.

**Database.** Full schema with RLS on every table, a cycle-rejecting trigger,
and a generated idempotent seed. Verified against PostgreSQL 16 by
`npm run db:verify`.

**Screens.** Home, recipe library with URL-backed filters, recipe detail with
live scaling, plan builder, consolidated shopping list, pantry, "cook with
what I have", fermentation planner with `.ics` export, cooking mode with
multiple timers and wake lock, import with side-by-side review, product
scanner, settings, cook history, plus not-found / error / loading / offline
states.

**Internationalization.** RU / EN / FR across UI, content, search, numbers,
dates and plurals, with fallback badges.

**Providers.** Open Food Facts, OpenAI-compatible extraction / vision /
translation / narration, Supadata transcripts — each with an honest disabled
state naming its environment variable.

**PWA.** Manifest, icons, hand-written service worker, offline reading and
offline cooking progress.

---

## Not yet built

These are gaps, stated plainly.

### Recipe editor

The detail screen is read-only. Creating and editing recipes, steps and
translations through the UI is the largest missing piece — today a recipe is
added by editing the seed catalog or by importing one. The RU/EN/FR tabbed
editor with an AI-translate button described in the brief is not implemented.

### Import approval

The import pipeline runs end to end and the review screen renders unknowns and
conflicts correctly, but the **Save** button does not yet write the approved
candidate into the database. The pieces it needs — ingredient matching against
the catalog, creating new ingredients on confirmation, writing evidence rows —
are designed but not wired.

### Versions and comparison

`recipe_versions` and `recipe_experiments` exist in the schema and the history
screen lists cook sessions, but the version-diff view (amounts, baker's
percentages, times, temperatures side by side) and "make this the main
version" are not implemented.

### Cook session persistence

Cooking progress is saved locally and survives reloads. Writing a finished
session back through the repository — rating, photo, note — is implemented in
the repository layer but not yet connected to the end-of-cook screen.

### Supabase repository coverage

Reads, pantry, plan, sessions and settings are implemented. Recipe *writes*
through Supabase (create, update, delete) are not, because the editor that
would use them does not exist yet.

### Offline writes

Deliberately out of scope for this release. Reads and local cooking progress
work offline; mutations require a connection and fail loudly. A sync queue is
only worth building if it is reliable.

### Photo recipe import

The tab exists and explains what it needs. The vision provider and schema are
implemented and used by the product scanner, so wiring the photo importer is
mostly plumbing.

### Notifications

Timers work in the foreground. Push notifications for a finished timer are a
progressive enhancement that needs a permission flow and a push subscription;
neither is built.

---

## Known limitations

**The owner's pizzas have no quantities.** This is intentional and follows the
brief: amounts the owner never stated are `unknown`, and the app says so. It
does mean the headline scaling demo runs on the dough recipes, which have real
figures from their sources. Filling in one amount in the editor (once built)
will make the pizzas scale too.

**The tomato sauce has no yield** until a can size is chosen, so pizzas using
it report "this component has no yield yet" rather than expanding. That is the
designed behaviour, not a bug — but a small "choose your can size" affordance
on the sauce would turn a correct message into a solved problem, and is the
single highest-value next change.

**`ALLOWED_EMAILS` is checked, but the sign-in UI is not built.** Demo mode
needs no sign-in, and the allowlist plumbing (`isEmailAllowed`, the
`access_allowlist` table, the Settings status panel) is in place. The magic-link
screen itself is not.

---

## Suggested order of work

1. Can-size selection for the tomato sauce, unblocking the full pizza →
   sauce → ingredient chain.
2. Recipe editor, including the translation tabs.
3. Import approval, reusing the editor's ingredient matcher.
4. Sign-in screen and the allowlist flow.
5. Versions and comparison.
6. Photo import and push notifications.
