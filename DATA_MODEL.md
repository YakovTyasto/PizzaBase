# Data model

Schema lives in `supabase/migrations/`. This document explains the shape and
the reasoning; the SQL is the source of truth.

Verify it against a scratch database at any time:

```bash
npm run db:verify
```

That applies both migrations to a fresh database, seeds it twice, and asserts
the invariants below.

---

## Conventions

- **Quantities are `numeric`, never float.** Accumulated grams must not drift.
- **`owner_id` null means shared.** Catalog tables (ingredients, categories,
  styles, oven profiles, packages, substitutions) are readable by every
  signed-in user when `owner_id` is null and private when it is set. Recipes
  and everything personal always have an owner.
- **Slugs are stable.** They are the upsert key for seeding and the id used in
  demo mode, which is why URLs read `/recipes/margherita-user`.
- **Translations live in side tables** keyed by `(entity_id, locale)`. One
  canonical row, many languages.
- **RLS is on for every table.** An assertion fails the verification script if
  a new table arrives without it.

---

## Identity and access

| Table | Purpose |
| --- | --- |
| `profiles` | Locale, timezone, temperature unit, default pizza size, default dough ball, default oven. Keyed to `auth.users.id`. |
| `user_settings` | App name override, enabled providers, recommendation rules, preferred shopping units. |
| `access_allowlist` | Server-side allowlist so access can change without a redeploy. Has **no policies**, so RLS denies every client request; only the service role reads it. |

There is no public sign-up. `ALLOWED_EMAILS` covers the simple case.

---

## Catalog

| Table | Notes |
| --- | --- |
| `ingredient_categories` (+ translations) | Shopping-list departments, with a sort order. |
| `ingredients` | `measure`, `base_unit`, optional `density_g_per_ml`, `allergens`, and a `parent_id` linking e.g. bufala and fior di latte to a shared mozzarella. |
| `ingredient_translations` | Name, plural forms, description per locale. |
| `ingredient_aliases` | `normalized_alias` is a **generated column** (`normalize_search(alias)`), indexed with `gin_trgm_ops`. This is what makes a Russian query find a French alias. |
| `ingredient_package_options` (+ translations) | Net quantity and unit per package, with a `preferred` flag and an optional barcode. |
| `ingredient_substitutions` (+ translations) | `quality_grade` and an `approved` flag. **Unapproved rows are kept deliberately** so the UI can explain why a swap is refused. |
| `styles`, `oven_profiles` (+ translations) | Reference data. |

`density_g_per_ml` is null unless a real figure exists. A null density means
volume↔mass conversion is *refused* for that ingredient, which is the correct
outcome rather than a plausible guess.

---

## Recipes

`recipes` holds the type (`pizza` / `dough` / `sauce` / `prep`), status,
authenticity class, style, oven profile, origin locale, base yield, base size
and shape, base ball weight, times, difficulty and tags.

### `recipe_items` — the composition line

Two constraints carry real weight:

```sql
constraint recipe_item_single_target check (
  (ingredient_id is not null and component_recipe_id is null)
  or (ingredient_id is null and component_recipe_id is not null)
)
```

A line is either an ingredient or a nested component, never both and never
neither. Enforced by the database rather than by convention.

```sql
create trigger recipe_items_no_cycle
  before insert or update of component_recipe_id on recipe_items
  for each row execute function assert_no_recipe_cycle();
```

The trigger walks the component graph recursively and rejects any link that
would close a loop — "this sauce contains the pizza that contains it". The
domain layer detects cycles too, but the trigger makes the invariant true of
the *data*, not merely of the code that reads it.

Amounts use the `(amount, amount_max, unit)` triple:

| Meaning | amount | amount_max | unit |
| --- | --- | --- | --- |
| exact, 310 g | `310` | null | `g` |
| range, 25–30 g | `25` | `30` | `g` |
| qualitative, to taste | null | null | `to_taste` |
| **unknown** | null | null | null |

Unknown is null, never zero. An assertion checks this after seeding.

### Steps

`recipe_steps` separates `active_minutes` from `wait_min_minutes` /
`wait_max_minutes`, because twenty minutes of kneading and twenty-four hours
of waiting are not the same commitment. `duration_known` is false when the
source never stated a duration, which drives the "approximate timing" badge in
the fermentation planner.

`recipe_step_items` links a step to the specific ingredients it uses, so
cooking mode can show them beside the instruction.

---

## Provenance

This is the part that makes the app trustworthy.

| Table | Purpose |
| --- | --- |
| `recipe_sources` | Type, author, title, URL, published/imported dates, attribution, and a `credibility_tier` (0–1) that feeds recommendation ranking. |
| `source_timecodes` | Links a step to a start/end second in a video. |
| `field_evidence` | Evidence about **one field of one entity**: confidence, `review_state`, and a `conflict_group` joining competing claims about the same value. |
| `field_evidence_translations` | The human-readable note, per locale. |

Per-field granularity is the point: one disputed salt weight can be flagged
without casting doubt on the rest of the recipe. Rows sharing a
`conflict_group` are competing claims, shown side by side and never resolved
automatically.

Full third-party transcripts are **not** stored. `import_jobs.payload` is
transient working data, cleared once structuring succeeds.

---

## Versions, cooking, experiments

| Table | Purpose |
| --- | --- |
| `recipe_versions` | Immutable `jsonb` snapshot, numbered per recipe, with an `is_primary` flag. |
| `cook_sessions` | Recipe, version, scale factor, start/finish, rating, notes, outcome. |
| `cook_step_progress` | Completed steps and timer state. |
| `cook_session_media` | Photos of the result. |
| `recipe_experiments` | Comparison of two or more versions and what changed. |

---

## Pantry and products

| Table | Purpose |
| --- | --- |
| `recognized_products` | Barcode, brand, net quantity, matched ingredient, OCR text, allergens, `source` (`barcode` / `ocr` / `vision` / `manual`), confidence. `image_storage_path` is null unless the user explicitly asked to keep the photo. |
| `pantry_items` | Ingredient, optional recognized product, quantity, unit, package count, opened flag, purchase and expiry dates, location. |

---

## Planning and shopping

| Table | Purpose |
| --- | --- |
| `meal_plans` | Serve time and notes. |
| `meal_plan_recipes` | Per-pizza count, shape, size, ball weight, scale mode, and dough/sauce overrides. |
| `shopping_lists` | A generated snapshot with an `is_stale` flag. |
| `shopping_list_items` | Required, pantry, to-buy, chosen package and count, leftover, checked state, category, and a `provenance` jsonb array for the "why is this here" drill-down. |

The snapshot is a convenience. The plan and the pantry remain the source of
truth, and the shopping screen recomputes on every visit so a stale list can
never be shown.

---

## Imports

| Table | Purpose |
| --- | --- |
| `import_jobs` | Type, status, source URL or upload path, provider, transient payload, error. |
| `import_candidates` | The structured extraction *before* approval, its validation issues, its confidence, and the recipe it eventually became. |

A candidate never becomes a recipe without an explicit human approval.

---

## Storage

Two private buckets, `recipe-media` and `scan-uploads`, both capped at 10 MB
with an image MIME allow-list. Objects are namespaced `<user-id>/<filename>`
and policies compare `(storage.foldername(name))[1]` to `auth.uid()`. There is
no public write path into either bucket.

---

## Seeding

`supabase/seed.sql` is **generated** from `src/lib/seed/*.ts` by `npm run seed`.
The catalog is authored once in TypeScript and projected two ways — demo mode
reads it directly, the generator emits SQL — so the two cannot drift.

Every statement upserts on a slug; items, steps and evidence are rebuilt so an
edit in the catalog is reflected exactly rather than accumulating stale rows.
Re-running changes no row counts, which `npm run db:verify` checks by seeding
twice and comparing.
