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
steps with phases, durations, temperatures and sensory cues; source,
attribution, credibility and per-field evidence; yield, diameter, shape, tray
dimensions and ball weight, with live baker's percentages; and photos. Cycles
are refused in three places — the component picker, the repository, and a
database trigger.

**Photos.** Multiple per recipe, with a cover, ordering, per-locale alt text
and visible compression progress. Every image is scaled and re-encoded in the
browser first, which strips EXIF including location. Supabase stores them in a
private bucket namespaced by owner with short-lived signed URLs; demo mode
keeps the bytes in the browser's own IndexedDB. Deleting a recipe cleans up
its objects rather than leaving them unreachable and billed for.

**Real persistence, and honesty about when there is none.** One
`save_recipe_with_media` function writes a whole recipe — translations,
ingredients, steps, source, evidence, photos — in a single transaction under
the caller's own RLS. Demo mode stores changes server-side on top of the seed;
they survive a browser restart, and Settings has a confirmed reset that clears
the photos too.

There are three storage modes, reported by `/api/health` as `supabase`, `demo`
or `demo-readonly`. The third is what a serverless deployment without Supabase
actually is: the bundle's filesystem is read-only, so the demo overlay cannot
be written at all. That case is now decided up front rather than discovered
from a failed `mkdir` — every mutation is refused before any I/O, the controls
that would have produced one are disabled with a localized explanation, and
optimistic UI is withdrawn when a write does not land. Failures cross the wire
as codes rather than messages, so a server path can never be rendered.

`npm run seed:owner -- <uuid>` seeds the bundled catalog into a real Supabase
project using the server-only service-role key, so a first deployment needs no
`psql` and no direct connection string. It is idempotent and is also how a
change to `src/lib/seed/` is pushed.

**Import that finishes**, from three sources: a YouTube transcript, pasted
text, or a photograph. Each goes through the same review screen and the same
idempotent approval path — content-derived keys mean approving twice produces
one recipe. Extracted names are matched against the catalog across all three
locales and their aliases; new canonical ingredients are created only when
asked. The source photograph is kept only if the owner ticks the box.

**AI translation that cannot change a number.** Numbers, ranges, temperatures,
percentages, timecodes and URLs are compared between source and proposal as
multisets; anything that lost, gained or rounded a figure is shown struck
through and cannot be applied. Existing hand-written translations are never
overwritten without an explicit tick. Ingredient names are out of scope by
construction.

**Sign-in.** Magic links via Supabase, refused before any mail is sent for an
address not on the allowlist and re-checked when the link is used. Demo mode
has its own clearly-labelled local entry.

**Versions, comparison and experiments.** Changing a verified recipe snapshots
what it was. The comparison screen groups changes by quantity, timing,
temperature, step and note; the experiments screen puts two or more versions
side by side on hydration, salt, yeast, preferment share, flour, fermentation,
ball weight, temperature and yield, records a hypothesis and a conclusion, and
can promote a winner without destroying what it replaced.

**Cooking, end to end.** One step at a time with timers and wake lock, then a
result screen: overall, taste, crust, handling, the times it actually took, a
note, what to change next time, and photos — recorded against the exact
version and scale that were cooked, and shown in history.

**Needs review.** Every unknown quantity, missing component yield and recorded
conflict, answerable in place, with the real package sizes offered for yield
questions and none of them preselected.

**Offline writes.** Recipe drafts and cooking results queue on the device,
are labelled as queued rather than as saved, and replay when the connection
returns with an idempotency key so a lost response cannot produce a duplicate.
A server-side change is parked as a conflict with the local copy intact.

**Notifications** for timers and fermentation stages, behind an explicit
opt-in, with copy generated from what the platform can actually deliver rather
than from hope. Everything degrades identically when refused or unsupported.

**Cost controls.** Images compressed before any Vision call, transcripts
truncated, extractions cached by content hash, per-owner rate windows on
extraction, vision and translation. Nothing calls a paid API on a page load.

**Database.** Full schema with RLS on every table, a cycle-rejecting trigger,
private storage buckets with owner-scoped policies for all four operations,
the authoring functions and their idempotency ledger, and a generated
idempotent seed. `npm run db:verify` applies every migration to an empty
database and asserts it.

**Production setup.** Startup validation that refuses incoherent
configurations, a health endpoint that reports state without leaking secrets,
`.env.example` split by what is actually required, `vercel.json`, and a README
with a two-minute demo route and a step-by-step production route where every
step ends in something you can check.

**Tests.** 279 unit tests (Vitest) and 230 end-to-end tests (Playwright, run
at both 390 px and desktop, plus a full-journey pass at 390/820/1280), and SQL
assertions against real PostgreSQL. No test in the suite is skipped.

---

## Not yet built

These are gaps, stated plainly.

### Server push

Notifications fire while the app is open. Delivering one to a closed app needs
a push subscription, VAPID keys and a sender, and on iOS the site installed to
the home screen. The seam exists (`src/lib/notify/push-adapter.ts`) with an
honest disabled provider and documented variables; no sender is written, and
the UI never claims otherwise.

### Rate limiting across instances

The limiter's window is per server process and in memory. On a single instance
that is exactly right; across several it means the effective limit is the
per-instance one times the instance count. A shared store would fix it and is
another dependency to run — worth doing when there is more than one instance,
not before.

### Cook-session photos in demo mode are local only

A cook photo is stored the same way a recipe photo is, so in demo mode it
lives in that browser's IndexedDB. History on a second device shows the record
without the picture. This is inherent to demo mode rather than a bug, and
connecting Supabase resolves it.

### Experiments do not read cook sessions yet

The schema and the repository carry `session_ids`, and the comparison table is
built from versions. Pulling the recorded ratings of the cooks that used each
version into the same table is the obvious next step and is not built.

Versioning itself now works on the seeded catalog: a snapshot is taken whenever
an existing recipe genuinely changes, not only when it was already `verified`,
and an unchanged save produces none. Before that, nothing in the bundled
catalog could ever accumulate a version, so the Experiments screen listed every
recipe and told the owner the same thing about all of them.

### Hydration is editable, other percentages are not

The scaler can be re-hydrated: the target mass and every other baker's
percentage hold while flour and water rebalance, and a preferment keeps its
share of both. Salt, yeast and oil have no equivalent editor yet — the shape of
the domain function is there (`withHydration`), and the same treatment for the
other roles is a small extension rather than new machinery.

### HEIC

Refused with a message explaining what to do instead. Decoding it would mean
shipping a WebAssembly decoder to every visitor for a format only some phones
produce, and only when their owner has chosen not to save JPEG.

---

## Known limitations

**The owner's pizzas still have no quantities.** Intentional: amounts nobody
stated are `unknown`, and the app says so. They are answerable — `/ru/review`
lists every one, and answering updates the scaling, the shopping list and any
recipe using them as a component.

**The tomato sauce has no yield** until a can size is chosen. The review screen
offers the real package sizes, and the product scanner can now remember a size
it read from an actual label — so this is a question the owner can settle, and
deliberately not one settled for them.

**Demo mode is one machine.** Recipes persist under `.impasto-demo/` keyed by a
session cookie, photos in the browser's IndexedDB. That survives a restart but
does not follow you to another device and is not backed up. Connecting Supabase
is what that is for.

**A serverless demo saves nothing at all.** With no Supabase and no writable
filesystem the app runs in `demo-readonly`: the whole catalog is browsable and
every mutation is refused, clearly and in the user's language. This is the
honest behaviour for that configuration rather than a limitation to fix —
`IMPASTO_DEMO_DIR=/tmp/impasto` buys persistence for the life of one instance,
and Supabase is the real answer.

**The offline queue is per-device and narrow by design.** Recipe drafts and
cooking results only; anything else fails loudly rather than being replayed
against a server that may have moved on.

---

## Suggested order of work

1. Pull cook-session ratings into the experiment comparison.
2. Server push: subscription table with RLS, a VAPID sender, and the
   installation prompt iOS requires.
3. A shared rate-limit store, once there is more than one instance.
4. Experiments across recipes, not just versions of one.
