# Impasto

A personal, mobile-first recipe book for pizza — dough, sauces, preparations
and the pizzas built from them. It scales recipes correctly, consolidates a
shopping list across a whole pizza night, subtracts what is already in your
kitchen, and is careful never to invent a number nobody actually stated.

Russian, English and French throughout. Installable as a PWA. Works offline
for reading recipes and for the cooking session you are in the middle of.

---

## Run it in two minutes

No accounts, no database, no API keys.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You will be redirected to `/ru`; the language
switcher in the header moves between RU / EN / FR without leaving the page you
are on.

That is **demo mode**, and it is a working app rather than a display case: you
can write recipes, edit them, import one, and come back tomorrow to find them.
The bundled catalog is the starting point; everything you change is stored
separately on top of it and can be thrown away in one click from Settings.

The browser holds nothing but a short session id — the recipes themselves live
server-side under `.impasto-demo/`, so the catalog can grow without ever
running into a cookie size limit. A badge in the header says you are in demo
mode, because an app that quietly forgets your data is worse than one that
tells you it will.

### What to look at first

| Where | Why |
| --- | --- |
| `/ru/recipes/sisofo-forgotten-neapolitan` | A real formula. Change the ball count and watch every ingredient and the baker's percentages recompute. |
| `/ru/recipes/margherita-user` | The opposite: quantities the owner never wrote down, shown as questions rather than zeros. |
| `/ru/recipes/pesto-genovese-user` | A source that contradicts itself, recorded as a conflict instead of being quietly "fixed". |
| `/ru/plan` → `/ru/shopping` | Build a pizza night, get one consolidated list with pantry deduction and package rounding. |
| `/ru/recipes/new?type=sauce` | Write a recipe of your own. Four kinds of quantity, including "unknown", which stays unknown. |
| `/ru/review` | Every open question in one place — each answerable once, after which the calculations that depend on it follow. |
| `/ru/import?tab=text` | Paste any text. With no API key a fixture stands in, deliberately containing an unknown amount and a contradiction. |
| `/ru/settings` | Exactly which integrations are live and which environment variable would enable each one. |

### The ten-minute tour

Nothing below needs an account, a database or an API key:

1. Create a sauce at `/ru/recipes/new?type=sauce` — give it a yield, add a can
   of tomatoes, basil "to taste", and leave the oil's amount unknown.
2. Create a pizza and add that sauce as a *component*. Its ingredients expand
   into the pizza's list, scaled by how much of the batch you used.
3. Rescale the pizza; add it to `/ru/plan`; open `/ru/shopping` and see the
   sauce broken back down into what you actually have to buy.
4. Import the fixture at `/ru/import?tab=text` and approve it. Approving twice
   gives you one recipe, not two.
5. Mark a recipe verified, change a quantity, then open its **Versions** tab to
   compare what changed and restore the earlier one if you prefer it.
6. Answer something on `/ru/review`, then reload the browser. It is all still
   there.

---

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm start            # serve the production build

npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run check        # typecheck + lint + unit tests

npm run seed         # regenerate supabase/seed.sql from the TypeScript catalog
npm run db:verify    # apply migrations + seed to a scratch database and assert invariants
npm run icons        # regenerate the PWA icon set
```

### Running the e2e suite

Playwright builds the app and starts it on port 3100 in demo mode:

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

If your machine already has a Chromium that Playwright did not install, point
at it instead: `CHROMIUM_PATH=/path/to/chromium npm run test:e2e`.

---

## Connecting a real database

Demo mode is genuinely usable and it persists, but it is tied to one browser
and one machine's disk. To keep recipes properly, with an account and backups:

**1. Create a Supabase project** at <https://supabase.com/dashboard>.

**2. Copy the environment file.**

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
*Project Settings → API*, plus `SUPABASE_SERVICE_ROLE_KEY` from the same page.
Remove or set `DEMO_MODE=false`.

**3. Apply the migrations.** Either paste each file from
`supabase/migrations/` into the Supabase SQL editor in filename order, or use
the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**4. Allow yourself in.** There is no public sign-up. Put your address in
`ALLOWED_EMAILS`:

```bash
ALLOWED_EMAILS=you@example.com
```

**5. Seed the catalog.** Create your user first (sign in once), find its id in
*Authentication → Users*, then:

```bash
psql "$DATABASE_URL" -v owner_id="'<your-auth-user-id>'" -f supabase/seed.sql
```

Re-running this is safe: every statement upserts on a stable slug.

### Deploying to Vercel

Import the repository, then add the same environment variables under *Settings
→ Environment Variables*. Set `NEXT_PUBLIC_APP_URL` to your deployed URL.
Nothing else needs configuring — the build command and output are the Next.js
defaults.

---

## Optional integrations

Every one of these is optional. Without it the relevant button explains which
variable is missing rather than failing silently or pretending to work.

| Variable | Turns on |
| --- | --- |
| `OPENAI_API_KEY` | Recipe extraction from text and video, package recognition from a photo, AI translation, recommendation narration. |
| `SUPADATA_API_KEY` | Automatic YouTube transcripts. Without it the importer offers a paste box. |
| `OPENFOODFACTS_USER_AGENT` | Nothing — Open Food Facts needs no key — but their policy asks for a contact address in the User-Agent. |

`OPENAI_BASE_URL` points the same code at any OpenAI-compatible endpoint.

Barcode scanning uses the browser's own `BarcodeDetector` where available, so
the common case needs no key and sends no image anywhere.

---

## How it is put together

```
src/
  domain/        Pure, decimal-safe calculation engine. No I/O, heavily tested.
  lib/
    seed/        The recipe catalog, authored once in TypeScript.
    data/        Repository interface + demo and Supabase implementations.
    providers/   Adapters for every external service.
    config/      Zod-validated environment and app naming.
  app/[locale]/  Screens.
  components/    UI.
supabase/
  migrations/    Schema and Row Level Security.
  seed.sql       Generated from src/lib/seed. Do not edit by hand.
```

### Writing and saving

The editor, the importer and the review screen all funnel into one place:
`recipeDraftSchema` in `src/lib/data/recipe-draft.ts`. The editor validates
against it, the Server Action re-validates against it because a Server Action
is a public endpoint, and both repositories accept only what it produced.

Saving is a single operation on either backend. In Supabase the whole recipe —
translations, ingredients, steps, source, evidence — is written by one
`save_recipe` plpgsql function, so a failure part-way leaves no half-recipe;
`tests/sql/authoring.sql` proves that against real PostgreSQL. In demo mode the
overlay file is written whole, to a temporary file and renamed.

Two things can legitimately submit the same write twice: approving an import,
and replaying a draft you saved with no signal. Both carry an idempotency key
derived from the content, and the write is recorded against that key, so a
retry resolves to the recipe that already exists instead of making another.

### Offline

Reading a saved recipe and running a cooking session work with no connection.
Saving does too, for the two things that are safe to replay — recipe drafts and
cooking progress. They queue on the device, show as queued rather than as
saved, and replay when the connection returns. If the server has moved on in
the meantime the change is parked as a conflict with your copy intact, and you
are asked which side wins. Nothing else — plans, pantry, imports — is queued:
a half-working sync is worse than an honest refusal.

Further reading: [ARCHITECTURE.md](./ARCHITECTURE.md) for the design decisions,
[DATA_MODEL.md](./DATA_MODEL.md) for the schema, [ROADMAP.md](./ROADMAP.md) for
what is next.

The product name lives in exactly one place, `src/lib/config/app-config.ts`.
Change it there and it changes everywhere, including the installed PWA — which
is why the repository is called PizzaBase while the app introduces itself as
Impasto. Deciding between the two is a one-line edit, not a rename.
