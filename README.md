# Impasto

A personal, mobile-first recipe book for pizza — dough, sauces, preparations
and the pizzas built from them. It scales recipes correctly, consolidates a
shopping list across a whole pizza night, subtracts what is already in your
kitchen, and is careful never to invent a number nobody actually stated.

Russian, English and French throughout. Installable as a PWA. Works offline
for reading recipes and for the cooking session you are in the middle of.

There are two ways in, and you can stop after the first:

1. **[Demo mode](#route-1-run-it-in-two-minutes-with-no-keys)** — no account,
   no database, no API keys. A working app in two minutes, including writing
   your own recipes with photos.
2. **[A real deployment](#route-2-connecting-a-real-supabase-project)** —
   Supabase for the database, private photo storage and sign-in; optional AI
   providers; Vercel. Step by step, each step verifiable.

---

## Route 1: run it in two minutes, with no keys

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

### Where your data actually goes

There are three storage modes, and `/api/health` names the one in force:

| `mode`          | When                                | What happens to a change                                                            |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `supabase`      | Supabase credentials are set        | Saved to the database.                                                              |
| `demo`          | No Supabase, writable filesystem    | Kept on this machine's disk, under `IMPASTO_DEMO_DIR` (default `.impasto-demo/`).   |
| `demo-readonly` | No Supabase, no writable filesystem | Nothing is saved. Every mutation is refused up front and the controls are disabled. |

`demo-readonly` is what a serverless platform gives you: the deployment bundle
is read-only, so a demo overlay cannot be written at all. The catalog stays
fully browsable — you can read every recipe, scale it, plan a pizza night in
the scaler — but the plan, the pantry and the editor say plainly that nothing
can be kept until Supabase is connected. **Deploying to Vercel without Supabase
gives you a read-only demo**, which is a legitimate way to show the app and a
poor way to use it.

If you want a serverless demo that keeps data for the life of one instance, set
`IMPASTO_DEMO_DIR=/tmp/impasto`. That is a statement that the path is writable;
it will still be lost whenever the instance is recycled.

### What to look at first

| Where                                     | Why                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/ru/recipes/sisofo-forgotten-neapolitan` | A real formula. Change the ball count and watch every ingredient and the baker's percentages recompute.             |
| `/ru/recipes/margherita-user`             | The opposite: quantities the owner never wrote down, shown as questions rather than zeros.                          |
| `/ru/recipes/pesto-genovese-user`         | A source that contradicts itself, recorded as a conflict instead of being quietly "fixed".                          |
| `/ru/plan` → `/ru/shopping`               | Build a pizza night, get one consolidated list with pantry deduction and package rounding.                          |
| `/ru/recipes/new?type=sauce`              | Write a recipe of your own. Four kinds of quantity, including "unknown", which stays unknown.                       |
| `/ru/review`                              | Every open question in one place — each answerable once, after which the calculations that depend on it follow.     |
| `/ru/import?tab=text`                     | Paste any text. With no API key a fixture stands in, deliberately containing an unknown amount and a contradiction. |
| `/ru/settings`                            | Exactly which integrations are live and which environment variable would enable each one.                           |

### The ten-minute tour

Nothing below needs an account, a database or an API key:

1. Create a sauce at `/ru/recipes/new?type=sauce` — give it a yield, add a can
   of tomatoes, basil "to taste", and leave the oil's amount unknown.
2. Create a pizza and add that sauce as a _component_. Its ingredients expand
   into the pizza's list, scaled by how much of the batch you used.
3. Rescale the pizza; add it to `/ru/plan`; open `/ru/shopping` and see the
   sauce broken back down into what you actually have to buy.
4. Import the fixture at `/ru/import?tab=text` and approve it. Approving twice
   gives you one recipe, not two.
5. Mark a recipe verified, change a quantity, then open its **Versions** tab to
   compare what changed and restore the earlier one if you prefer it.
6. Attach a photo on the **Photos** tab, or import a recipe from one at
   `/ru/import` → Фото. Both work with no key: the image is compressed and
   stripped of metadata in your browser, and a fixture stands in for the
   vision provider.
7. Cook something from `/ru/recipes/.../cook`, walk to the last step, and
   record how it went — it lands in `/ru/history` against the exact version
   you cooked.
8. Compare two versions at `/ru/experiments`.
9. Answer something on `/ru/review`, then reload the browser. It is all still
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

npm run format       # Prettier over the tree
npm run seed         # regenerate supabase/seed.sql from the TypeScript catalog
npm run seed:owner -- <uuid>   # seed the catalog into Supabase for one owner
npm run db:verify    # apply migrations + seed to a scratch database and assert invariants
npm run icons        # regenerate the PWA icon set

curl localhost:3000/api/health   # configuration health; 503 when incoherent
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

## Route 2: connecting a real Supabase project

Demo mode is genuinely usable and it persists, but it is tied to one browser
and one machine's disk. This is the path to an account, a real database,
private photo storage and backups.

Work through it in order. Each step is independently verifiable, so you find
out at the step that broke rather than at the end.

### 1. Create the project

Create a project at <https://supabase.com/dashboard>. Note the region; put
your deployment in the same one.

### 2. Fill in the environment

```bash
cp .env.example .env.local
```

From _Project Settings → API_, set:

| Variable                        | Where it comes from                                  |
| ------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project URL                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | `service_role` key — server-only, never in a browser |

Then set `ALLOWED_EMAILS` to your own address, `NEXT_PUBLIC_APP_URL` to where
the app will live, and `DEMO_MODE=false`.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set
together. One without the other silently falls back to demo mode, which means
a real deployment quietly serving bundled fixtures — so startup refuses that
combination rather than letting you discover it later.

**Verify:** `npm run dev` prints no `[impasto] ERROR` lines, and
<http://localhost:3000/api/health> returns `"status": "ok"` with
`"mode": "supabase"`.

### 3. Apply the migrations

Either paste each file from `supabase/migrations/` into the SQL editor in
filename order, or use the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates the schema, Row Level Security on every table, the two private
storage buckets and their owner-scoped policies, and the `save_recipe`
function that writes a whole recipe in one transaction.

**Verify:** run the same checks the CI does against a scratch PostgreSQL:

```bash
npm run db:verify
```

It applies every migration to an empty database, seeds it twice to prove the
seed is idempotent, asserts the RLS and storage invariants, and exercises
`save_recipe` for atomicity.

### 4. Storage

The migrations create both buckets as **private**, capped at 2 MB, and
restricted to JPEG, PNG and WebP — the three formats the app can actually
decode. Objects are namespaced by owner id (`<uid>/<file>.jpg`) and the
policies key on that folder, so one owner can never read or overwrite
another's file. Pages mint short-lived signed URLs for exactly the photos
they render.

Nothing further to configure. If you see uploads failing with a policy
violation, check that migration `20260817000400` applied — it adds the UPDATE
policy that upserts need.

### 5. Auth redirect URLs

In _Authentication → URL Configuration_:

- **Site URL**: your production origin, e.g. `https://impasto.example.com`
- **Redirect URLs**: add every origin that will complete a magic link —

  ```
  http://localhost:3000/auth/callback
  https://impasto.example.com/auth/callback
  https://*-yourname.vercel.app/auth/callback
  ```

The wildcard covers Vercel preview deployments. Without a matching entry the
link lands on an error page instead of signing you in.

There is no public sign-up: an address not in `ALLOWED_EMAILS` is refused
before any mail is sent, and the allowlist is checked _again_ when the link is
used, because a magic link is a bearer token and the list may have changed in
between.

**Verify:** open `/login`, enter your allowed address, and follow the link.
Then try an address that is not on the list — it should be refused without
sending anything.

### 6. Seed the catalog

Sign in once so your user exists, then find its id in _Authentication →
Users_ and run:

```bash
npm run seed:owner -- <your-auth-user-id>
```

This reads `.env.local`, connects with the **server-only**
`SUPABASE_SERVICE_ROLE_KEY`, and writes the bundled catalog — categories,
ingredients, styles, oven profiles, package sizes, substitutions and all the
recipes — attributed to that owner. It needs no `psql` and no direct database
connection string.

Re-running is safe. Shared catalog rows are matched by slug and updated in
place; each recipe's items, steps, source and evidence are rewritten from the
seed. A second run converges on the same state rather than duplicating it, so
it is also how you push a change you made to `src/lib/seed/`.

If you would rather use SQL directly, `supabase/seed.sql` is generated from the
same catalog by `npm run seed` and does the same job:

```bash
psql "$DATABASE_URL" -v owner_id="'<your-auth-user-id>'" -f supabase/seed.sql
```

**Verify:** `/ru/recipes` lists the catalog while signed in, and running the
command a second time leaves the recipe count unchanged.

### 7. Optional AI providers

Add these one at a time; each is independently useful and independently off.
See the table under [Optional integrations](#optional-integrations).

**Verify:** `/settings` lists exactly which integrations are live and which
variable would enable each of the others.

### 8. Deploy to Vercel

Import the repository. Add the same environment variables under _Settings →
Environment Variables_, for **Production** and **Preview** separately —
previews should point at their own Supabase project if you do not want them
writing to real data.

`vercel.json` already sets the security headers, the service-worker cache
policy, and `no-store` on the health endpoint. The build command and output
are the Next.js defaults.

**Verify:** `https://<your-deployment>/api/health` returns 200 and
`"status": "ok"` with `"mode": "supabase"` and `"writable": true`. It reports
which integrations are on and never a key, a URL or an address.

If it returns `"mode": "demo-readonly"`, the deployment has no Supabase
credentials: it is serving the bundled catalog and refusing every write. That
is a configuration state, not a crash — go back to step 2.

---

## First-deployment checklist

Run through this once, in order. Everything is verifiable — no step ends in
"looks fine".

- [ ] `npm run check` passes (typecheck, lint, unit tests)
- [ ] `npm run db:verify` passes against a scratch PostgreSQL
- [ ] `.env.local` has both Supabase variables, or neither
- [ ] `ALLOWED_EMAILS` contains at least your own address
- [ ] `NEXT_PUBLIC_APP_URL` is the deployed origin, not localhost
- [ ] `DEMO_MODE` is `false` (or unset) in production
- [ ] `IMPASTO_MOCK_TRANSLATION` is **not** set in production
- [ ] `OPENFOODFACTS_USER_AGENT` has a real contact address
- [ ] Migrations applied; `/api/health` returns `"mode": "supabase"`
      (`"demo-readonly"` means Supabase is not connected and nothing will save)
- [ ] Auth redirect URLs include every origin, including previews
- [ ] Seed applied with `npm run seed:owner -- <your-auth-user-id>`
- [ ] Signed in once with a magic link, and a non-allowlisted address was refused
- [ ] Created a recipe with a photo, reloaded, and it is still there
- [ ] `/api/health` returns 200 with an empty `problems` array

---

## Backing up your recipes

The recipes are the part that cannot be regenerated. Everything else — the
seed catalog, the code — is in this repository.

**Automatic.** Supabase takes daily backups on paid plans; on the free plan it
does not, so the manual route below is not optional there.

**Manual, and worth doing before any migration:**

```bash
# Everything you have authored, without the schema.
pg_dump "$DATABASE_URL" --data-only \
  --table=recipes --table=recipe_translations \
  --table=recipe_items --table=recipe_steps --table=recipe_step_translations \
  --table=recipe_sources --table=field_evidence --table=field_evidence_translations \
  --table=recipe_media --table=recipe_media_translations \
  --table=recipe_versions --table=cook_sessions --table=recipe_experiments \
  > impasto-backup-$(date +%F).sql
```

Photos live in Storage rather than the database, so back the bucket up too:

```bash
npx supabase storage cp -r ss:///recipe-media ./recipe-media-backup
```

**Restoring** is the same file played back into an empty schema:

```bash
psql "$DATABASE_URL" -f impasto-backup-2026-08-18.sql
```

A restore into a _different_ Supabase project needs the `owner_id` columns
rewritten to the new user's id — every owned table carries it, and RLS will
otherwise hide rows that belong to a user that no longer exists.

**Demo mode** stores everything under `.impasto-demo/` as one JSON file per
browser session, plus the photos in the browser's own IndexedDB. Copying the
directory is a backup of the first half; the photos travel with the browser
profile and are removed by "Reset demo data".

---

## Optional integrations

Every one of these is optional. Without it the relevant button explains which
variable is missing rather than failing silently or pretending to work.

| Variable                   | Turns on                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`           | Recipe extraction from text and video, package recognition from a photo, AI translation, recommendation narration. |
| `SUPADATA_API_KEY`         | Automatic YouTube transcripts. Without it the importer offers a paste box.                                         |
| `OPENFOODFACTS_USER_AGENT` | Nothing — Open Food Facts needs no key — but their policy asks for a contact address in the User-Agent.            |

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
