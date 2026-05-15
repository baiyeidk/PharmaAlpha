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
# Schema migration strategy (in priority order):
#
#   A. PRISMA_ALLOW_DB_PUSH=true (highest priority, DEV/DEMO only)
#      Always use `db push --accept-data-loss` to keep db schema
#      in sync with prisma/schema.prisma. Skips migration history.
#      Use this when iterating fast and migrations are out of sync.
#
#   B. Has _prisma_migrations table OR empty db
#      Use `prisma migrate deploy` (versioned, production-safe).
#
#   C. Has user tables but no _prisma_migrations table
#      STOP. The db was created by a previous `db push` and needs
#      to be baselined manually (or PRISMA_ALLOW_DB_PUSH=true used).
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

if [ "${PRISMA_ALLOW_DB_PUSH:-false}" = "true" ]; then
  echo "PRISMA_ALLOW_DB_PUSH=true → using db push (schema drift will be resolved)"
  echo "  WARNING: this is DEV/DEMO-only. It can drop columns/tables on schema drift."
  npx prisma db push --accept-data-loss
elif [ "$HAS_MIGRATIONS_TABLE" = "t" ] || [ "$HAS_USER_TABLES" = "f" ]; then
  echo "running prisma migrate deploy..."
  npx prisma migrate deploy
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
