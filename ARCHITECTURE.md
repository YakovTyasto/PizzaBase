# Architecture

The decisions that shape this codebase, and why they were made that way.

## 1. The arithmetic is ordinary code

`src/domain/` is a pure package: no I/O, no framework, no network. Scaling,
nested recipe expansion, baker's percentages, pantry deduction and package
rounding all live here as plain functions, and they are the most heavily
tested part of the project.

No language model is involved in any calculation. An LLM may later write one
sentence explaining *why* a recipe was suggested, but the candidate set, the
quantities and the missing list are computed deterministically so they can be
tested and cannot drift.

The same functions run on the server and in the browser. The recipe detail
screen recomputes scaling client-side by calling `expandRecipe` directly —
there is no second implementation of the maths in the UI, which is what
guarantees the number on screen matches the number on the shopping list.

### Decimal, not float

Every quantity is a `Decimal` in TypeScript and `numeric` in PostgreSQL.
Accumulating a shopping list in binary floating point drifts, and drifting
grams are precisely what a recipe app must not do. Rounding happens once, at
the presentation layer, in `src/lib/format.ts`.

### Amounts have four shapes

```ts
type Amount =
  | { kind: 'exact';       value: Decimal; unit: Unit }
  | { kind: 'range';       min: Decimal; max: Decimal; unit: Unit }
  | { kind: 'qualitative'; unit: 'pinch' | 'handful' | 'to_taste' | 'as_needed' }
  | { kind: 'unknown' }
```

This is the single most load-bearing type in the codebase. Because `unknown`
and `qualitative` are first-class, "salt to taste" can never become invented
grams, and a quantity nobody stated is a question mark rather than a zero.
Scaling a qualitative amount returns it unchanged. Adding a non-numeric amount
throws rather than guessing.

### Units convert only within a measure

Mass converts to mass, volume to volume. `count` and `package` units convert
solely to themselves — a clove is not a leaf, a can is not a jar. Volume to
mass requires the density of that specific ingredient; there is no global
default, because 1 ml of olive oil is 0.91 g and 1 ml of honey is 1.42 g, and
assuming 1 g/ml would silently corrupt any list mixing the two.

### Nested recipes

A pizza asking for 80 g of a sauce whose batch yields 400 g pulls in one fifth
of that sauce's ingredients. Expansion is recursive with cycle detection,
memoized per call tree, and every resulting line carries a root-first
provenance chain so the UI can answer "why is this tomato in my basket?".

When a component cannot be expanded — no stated yield, or an unknown requested
amount — the engine returns a typed *issue* rather than contributing nothing.
The screen then says "this sauce has no yield yet" instead of quietly
under-reporting the list.

### Size scaling

Round toppings scale by area, `(target/base)²`: a 40 cm pizza has 1.78× the
surface of a 30 cm one, not 1.33×. Rectangular trays use the ratio of areas.
Dough scales independently by ball count and ball weight, because those are
different questions from "how big is the pizza". The user can override area
scaling with plain portion scaling.

## 2. Honesty is a design constraint, not a policy

The product's differentiator is that it says what it does not know.

- The owner's seven pizzas ship as `draft` with unknown amounts, because those
  quantities were never stated. They are never labelled `traditional`.
- The pesto records its stated 150–170 g yield as a **conflict** even though
  the ingredients plainly exceed it. The source is not corrected silently.
- The Iacopelli dough keeps salt as 25–30 g and yeast as 5–6 g, because
  transcriptions disagree. No value is picked on the user's behalf.
- The arrabbiata sausage stays unspecified rather than being guessed.
- Substitutions are a curated allow-list. Unapproved rows stay in the table so
  the UI can explain *why* a swap is refused, which is how the app answers "no
  tomatoes" with "add them to the list" rather than something that does not
  belong on a pizza.

These are enforced by tests, not by discipline: `src/lib/seed/seed.test.ts`
asserts them on the catalog and `tests/sql/assertions.sql` re-asserts them
after the round trip through PostgreSQL.

## 3. Two backends behind one interface

`src/lib/data/types.ts` defines a single `Repository`. There are two
implementations and no screen knows which is active.

**Demo mode** (`demo/repository.ts`) serves the bundled seed and stores the
things a user changes in a validated cookie. This is not a stub: pantry
deduction genuinely works, the plan persists, cooking sessions are recorded.
It is what makes `npm install && npm run dev` a complete experience.

**Supabase** (`supabase/repository.ts`) runs every query as the signed-in user,
so Row Level Security is the enforcing layer. The repository never filters by
owner itself — doing both would create two places for the rule to drift.

Selection is automatic: no Supabase credentials means demo mode, and
`DEMO_MODE=true` forces it.

## 4. Providers are adapters with an honest disabled state

Every external capability — product lookup, vision, transcripts, extraction,
translation, narration — sits behind an interface in
`src/lib/providers/types.ts`. Each has a real implementation and a disabled
one. A disabled provider throws `ProviderDisabledError` naming the environment
variable that would enable it, and the UI renders that as "set OPENAI_API_KEY
to enable this". There are no dead buttons and no silent no-ops.

Two provider decisions are worth calling out:

**Extraction schemas make `unknown` expressible.** A model asked for a number
will produce one; a model given `{"kind":"unknown","reason":"..."}` will use
it. Every guarantee about not fabricating quantities rests on that schema
shape plus the local zod parse that follows.

**Extractions are validated arithmetically before a human sees them.**
Inverted ranges, impossible temperatures and duplicate ingredients are caught
in `validateExtraction`; errors block approval outright.

Nothing an import produces is saved automatically. The user reviews a
*candidate*, and the review screen deliberately makes unknowns and conflicts
loud.

## 5. Internationalization covers content, not just chrome

Three complete message catalogs with correct Russian few/many plural forms; a
test asserts the three share keys and ICU placeholders.

Content translations live in side tables keyed by locale. One canonical
ingredient, one formula; names and instructions are translated separately.
Resolution follows requested locale → the content's own origin locale →
English, and **records which locale actually supplied the string** so the UI
can badge it. Serving Russian to a French reader with no explanation is the
failure mode being designed against.

Search spans all three languages at once. A Russian query finds an ingredient
through its French alias, because matching is done on an accent- and
case-folded key (`unaccent` in PostgreSQL, the same normalization in
TypeScript for demo mode).

## 6. Security

- RLS on every table. Child tables are guarded through their parent, so a
  translation row is reachable only if its recipe is.
- The catalog is shared when `owner_id` is null and private otherwise, which
  keeps one ingredient library while leaving the schema multi-user ready.
  Users can read shared rows but cannot insert into them.
- The service-role key is confined to `src/lib/supabase/server.ts`, which is
  marked `server-only` — importing it into a client bundle is a build error,
  not a leak.
- The YouTube importer accepts only `youtube.com` / `youtu.be` and normalizes
  to an 11-character id before anything is fetched, so a pasted URL cannot
  become an arbitrary outbound request. Tested against SSRF-shaped inputs
  including `169.254.169.254`.
- Uploads are checked for MIME and size before a byte reaches a paid API.
- Transcripts are structured and then discarded; only the derived recipe, its
  attribution and its timecodes are kept.
- Server Actions validate their input with zod rather than trusting the form.

## 7. Offline

A hand-written service worker (`public/sw.js`) with three strategies: the app
shell and static assets cache-first, navigations network-first with a cache
fallback, everything else straight to the network.

Cooking progress and timers live in local storage, so a reload or a lost
connection mid-bake costs nothing. Timers store an **absolute end timestamp**
rather than a countdown, so a phone that slept for twenty minutes comes back
with the correct remaining time instead of twenty minutes behind.

Offline *writes* are deliberately not queued. The first release is explicit
that saved recipes are readable offline and cooking progress is local, but
mutations need a connection. A half-working sync queue would be worse than a
stated limitation.

## 8. Framework notes

Next.js 16 App Router with React Server Components by default; client
components only where interactivity or a browser API demands it. Turbopack is
the default builder. `params` and `searchParams` are async, and the middleware
convention is now `proxy.ts` — both are Next 16 breaking changes this codebase
is written against rather than around.

`Decimal` cannot cross the server/client boundary, so the recipe graph travels
as strings and is rehydrated on the client (`src/lib/data/serialize.ts`).
Strings, not numbers: routing a decimal through a JS float on the way to the
browser would defeat the point of using decimals at all.

Browser capability checks use `useSyncExternalStore` rather than a
state-setting effect, which avoids both hydration mismatches and cascading
renders.
