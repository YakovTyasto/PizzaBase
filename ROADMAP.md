# Roadmap

Where the project actually stands, and what comes next. Nothing here is
aspirational filler — the "not yet built" section lists real gaps.

## Built and working

**The calculation engine.** Decimal-safe units, four amount shapes, nested
recipe expansion with cycle detection and provenance, area-based size scaling,
baker's percentages, pantry deduction, package rounding, backward fermentation
scheduling, and deterministic recommendation ranking.

**Authoring.** A full editor for pizzas, doughs, sauces and preparations:
RU/EN/FR names, summaries, notes and step instructions with fallback; draft /
needs-review / verified; ingredients and nested components; exact, range,
qualitative and unknown quantities; groups, ordering and preparation notes;
steps with phases, active and waiting durations, temperatures and sensory cues;
source, attribution, credibility and per-field evidence; yield, diameter,
shape, tray dimensions and ball weight, with live baker's percentages. Cycles
are refused in three places — the component picker, the repository, and a
database trigger.

**Real persistence.** Writes go through the repository layer to whichever
backend is configured. In Supabase one `save_recipe` function writes the whole
recipe in a single transaction under the caller's own RLS, so a failure leaves
no half-recipe. In demo mode changes are stored server-side on top of the seed
and survive a browser restart; the cookie holds only a session id, and
Settings has a confirmed "reset demo data".

**Import that finishes.** Approving a candidate matches every extracted name
against the catalog across all three locales and their aliases, creates new
canonical ingredients only when asked, writes the recipe with its
translations, steps, source, evidence and timecodes, and opens the saved
recipe. A content-derived idempotency key means approving twice — or
double-clicking — produces one recipe. The transcript is discarded once
structuring succeeds.

**Sign-in.** `/login` with Supabase magic links, refused before any mail is
sent for an address that is not on the allowlist, re-checked when the link is
used, and returning to the route the visitor was heading for. Demo mode gets
its own clearly-labelled local entry rather than a form that could not work.

**Versions and comparison.** Changing a verified recipe snapshots what it was.
The comparison screen groups changes by quantities, timings, temperatures,
steps and notes, shows baker's percentages before and after, and can make an
earlier version primary without destroying the current one.

**Needs review.** Every unknown quantity, missing component yield and recorded
conflict, gathered per recipe and answerable in place. Answering once updates
everything downstream. Yield questions offer the real package sizes plus free
entry — no size is ever preselected as the answer.

**Offline writes.** Recipe drafts and cooking progress can be saved with no
connection. They queue on the device, are labelled as queued rather than as
saved, and replay when the connection returns, carrying an idempotency key so
a replay whose response was lost cannot produce a duplicate. A server-side
change is parked as a conflict with the local copy intact and the owner
chooses. Plans, pantry and imports still require a connection and say so.

**Database.** Full schema with RLS on every table, a cycle-rejecting trigger,
the authoring function and its idempotency ledger, and a generated idempotent
seed. Verified against PostgreSQL 16 by `npm run db:verify`, which also
asserts that `save_recipe` is atomic.

**Screens.** Home, library with URL-backed filters, recipe detail with live
scaling, editor, needs-review, versions, sign-in, plan builder, consolidated
shopping list, pantry, "cook with what I have", fermentation planner with
`.ics` export, cooking mode with multiple timers and wake lock, import with
side-by-side review, product scanner, settings, cook history, plus not-found /
error / loading / offline states.

**Internationalization.** RU / EN / FR across UI, content, search, numbers,
dates and plurals, with fallback badges.

**Providers.** Open Food Facts, OpenAI-compatible extraction / vision /
translation / narration, Supadata transcripts — each with an honest disabled
state naming its environment variable.

**PWA.** Manifest, icons, hand-written service worker, offline reading and
offline cooking progress.

**Tests.** 213 unit tests (Vitest) and 156 end-to-end tests (Playwright, run
at both 390 px and desktop widths), plus SQL assertions against real
PostgreSQL. No test in the suite is skipped.

---

## Not yet built

These are gaps, stated plainly.

### Photos on a recipe

The editor covers every field the brief lists except images: `recipe_media`
exists in the schema and the draft carries a `media` array, but there is no
upload control and no storage bucket wired up. Everything else about a recipe
can be authored through the UI.

### AI translation button

Translations are authored by hand in the RU/EN/FR tabs, and a missing one
falls back to the origin language with a badge. The "translate this field"
button that would call the configured provider is not built; the provider
itself is.

### End-of-cook capture

A cooking session's progress and the recipe version it used are recorded.
Rating, photo and a note at the end of a cook are implemented in the
repository but not yet offered by the cooking screen.

### Photo recipe import

The tab exists and explains what it needs. The vision provider and schema are
implemented and used by the product scanner, so wiring the photo importer is
mostly plumbing.

### Experiments

`recipe_experiments` exists in the schema. Recording "I tried this variation
and here is what happened" as a first-class thing, separate from a version, is
not built.

### Notifications

Timers work in the foreground. Push notifications for a finished timer are a
progressive enhancement that needs a permission flow and a push subscription;
neither is built.

---

## Known limitations

**The owner's pizzas still have no quantities.** This is intentional and
follows the brief: amounts nobody stated are `unknown`, and the app says so
rather than inventing them. The difference from before is that they are now
answerable — `/ru/review` lists every one of them, and answering updates the
scaling, the shopping list and any recipe that uses them as a component.

**The tomato sauce has no yield** until a can size is chosen, so pizzas using
it report "this component has no yield yet" rather than expanding. The review
screen now offers the real package sizes alongside free entry, so this is a
question the owner can settle in one click — but it is deliberately not
settled for them.

**Demo mode is one machine.** Changes persist under `.impasto-demo/`, keyed by
a session cookie. That survives a browser restart but does not follow you to
another device, and it is not backed up. That is what connecting Supabase is
for.

**The offline queue is per-device and narrow by design.** It covers recipe
drafts and cooking progress. Anything else fails loudly rather than being
replayed against a server that may have moved on.

---

## Suggested order of work

1. Photos: storage bucket, upload control, and the media strip on the recipe
   page.
2. End-of-cook capture, closing the loop from cooking session to history.
3. The AI translation button in the editor.
4. Photo recipe import.
5. Experiments as a first-class record.
6. Push notifications for timers.
