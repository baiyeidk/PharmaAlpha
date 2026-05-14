#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

DB_URL_NO_QUERY="${DATABASE_URL%%\?*}"

echo "waiting for database..."
until pg_isready -d "$DB_URL_NO_QUERY"; do
  sleep 2
done

echo "ensuring pgvector extension..."
psql "$DB_URL_NO_QUERY" -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# ────────────────────────────────────────────────────────────────
# Schema migration: prefer `prisma migrate deploy` (versioned, safe).
#
# Three possible db states we have to handle:
#   1. Empty database                 → migrate deploy applies everything
#   2. DB previously managed by migrate (has _prisma_migrations table)
#                                     → migrate deploy applies any pending
#   3. DB previously managed by `db push` (schema exists but no
#      _prisma_migrations table)     → STOP and ask the operator to baseline
#
# Set PRISMA_ALLOW_DB_PUSH=true to fall back to the legacy
# `db push --accept-data-loss` behavior — DEV ONLY, never in production.
# ────────────────────────────────────────────────────────────────

echo "checking schema migration state..."

HAS_MIGRATIONS_TABLE=$(
  psql "$DB_URL_NO_QUERY" -tAc \
    "SELECT to_regclass('public._prisma_migrations') IS NOT NULL"
)
HAS_USER_TABLES=$(
  psql "$DB_URL_NO_QUERY" -tAc \
    "SELECT count(*) > 0
     FROM information_schema.tables
     WHERE table_schema='public'
       AND table_type='BASE TABLE'
       AND table_name <> '_prisma_migrations'"
)

if [ "$HAS_MIGRATIONS_TABLE" = "t" ] || [ "$HAS_USER_TABLES" = "f" ]; then
  echo "running prisma migrate deploy..."
  npx prisma migrate deploy
elif [ "${PRISMA_ALLOW_DB_PUSH:-false}" = "true" ]; then
  echo "WARNING: legacy db push fallback enabled (PRISMA_ALLOW_DB_PUSH=true)."
  echo "         This is DEV-ONLY. It can drop columns/tables on schema drift."
  npx prisma db push --accept-data-loss
else
  cat >&2 <<'EOF'

ERROR: database has user tables but no _prisma_migrations table.
       This db was likely created by a previous `prisma db push` and is
       not yet baselined for migrations. Refusing to auto-resolve to
       avoid data loss.

How to fix (one-time on this database):
  # 1. Mark every existing migration as already-applied.
  for m in prisma/migrations/2026*; do
    npx prisma migrate resolve --applied "$(basename "$m")"
  done

  # 2. Then re-run this container; it will pick up future migrations
  #    automatically via `prisma migrate deploy`.

If you understand the risk and only have a throwaway DEV database,
restart the container with:
  PRISMA_ALLOW_DB_PUSH=true

EOF
  exit 1
fi

if [ "${RUN_PROJECT_FIRST_SEED:-false}" = "true" ]; then
  echo "running project-first seed..."
  psql "$DB_URL_NO_QUERY" -f prisma/seeds/project_first_demo.sql
else
  echo "skipping project-first seed (set RUN_PROJECT_FIRST_SEED=true to enable)"
fi

exec npm start
