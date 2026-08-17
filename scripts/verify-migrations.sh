#!/usr/bin/env bash
#
# Applies every migration and the generated seed to a throwaway database, then
# asserts the invariants the schema is supposed to guarantee.
#
# This is what backs the "migrations apply from a clean database" and "seed is
# repeatable without duplicates" claims: both are checked here rather than
# assumed. It needs only a plain PostgreSQL instance -- the Supabase-managed
# auth and storage objects are stubbed by tests/sql/supabase-stubs.sql.
#
# Usage:
#   scripts/verify-migrations.sh                 # uses PGHOST/PGPORT/PGUSER
#   PGHOST=/var/tmp PGPORT=5433 scripts/verify-migrations.sh

set -euo pipefail

DB_NAME="${DB_NAME:-impasto_verify}"
PSQL=(psql -v ON_ERROR_STOP=1 --quiet --no-psqlrc)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Recreating database ${DB_NAME}"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME};" >/dev/null
"${PSQL[@]}" -d postgres -c "create database ${DB_NAME};" >/dev/null

echo "==> Applying Supabase stubs"
"${PSQL[@]}" -d "${DB_NAME}" -f "${ROOT}/tests/sql/supabase-stubs.sql" >/dev/null

echo "==> Applying migrations"
for migration in "${ROOT}"/supabase/migrations/*.sql; do
  echo "    $(basename "${migration}")"
  "${PSQL[@]}" -d "${DB_NAME}" -f "${migration}" >/dev/null
done

echo "==> Creating a test owner"
OWNER_ID=$("${PSQL[@]}" -d "${DB_NAME}" -t -A -c \
  "insert into auth.users (email) values ('owner@example.test') returning id;")
echo "    ${OWNER_ID}"

echo "==> Seeding (first pass)"
"${PSQL[@]}" -d "${DB_NAME}" -v owner_id="'${OWNER_ID}'" -f "${ROOT}/supabase/seed.sql" >/dev/null

count() {
  "${PSQL[@]}" -d "${DB_NAME}" -t -A -c "select count(*) from $1;"
}

INGREDIENTS_1=$(count ingredients)
RECIPES_1=$(count recipes)
ITEMS_1=$(count recipe_items)
STEPS_1=$(count recipe_steps)
ALIASES_1=$(count ingredient_aliases)
EVIDENCE_1=$(count field_evidence)
TRANSLATIONS_1=$(count recipe_translations)

echo "    ingredients=${INGREDIENTS_1} recipes=${RECIPES_1} items=${ITEMS_1} steps=${STEPS_1} evidence=${EVIDENCE_1}"

echo "==> Seeding (second pass, must be idempotent)"
"${PSQL[@]}" -d "${DB_NAME}" -v owner_id="'${OWNER_ID}'" -f "${ROOT}/supabase/seed.sql" >/dev/null

INGREDIENTS_2=$(count ingredients)
RECIPES_2=$(count recipes)
ITEMS_2=$(count recipe_items)
STEPS_2=$(count recipe_steps)
ALIASES_2=$(count ingredient_aliases)
EVIDENCE_2=$(count field_evidence)
TRANSLATIONS_2=$(count recipe_translations)

fail=0
check_same() {
  if [ "$2" != "$3" ]; then
    echo "    FAIL: $1 changed on re-seed: $2 -> $3"
    fail=1
  fi
}
check_same ingredients "${INGREDIENTS_1}" "${INGREDIENTS_2}"
check_same recipes "${RECIPES_1}" "${RECIPES_2}"
check_same recipe_items "${ITEMS_1}" "${ITEMS_2}"
check_same recipe_steps "${STEPS_1}" "${STEPS_2}"
check_same ingredient_aliases "${ALIASES_1}" "${ALIASES_2}"
check_same field_evidence "${EVIDENCE_1}" "${EVIDENCE_2}"
check_same recipe_translations "${TRANSLATIONS_1}" "${TRANSLATIONS_2}"
[ "${fail}" -eq 0 ] && echo "    seed is idempotent"

echo "==> Asserting schema invariants"
"${PSQL[@]}" -d "${DB_NAME}" -v owner_id="'${OWNER_ID}'" -f "${ROOT}/tests/sql/assertions.sql"

echo
if [ "${fail}" -eq 0 ]; then
  echo "All migration and seed checks passed."
else
  echo "Some checks FAILED."
  exit 1
fi
