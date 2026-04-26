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

echo "syncing Prisma schema..."
npx prisma db push --accept-data-loss

if [ "${RUN_PROJECT_FIRST_SEED:-true}" = "true" ]; then
  echo "running project-first seed..."
  psql "$DB_URL_NO_QUERY" -f prisma/seeds/project_first_demo.sql
else
  echo "skipping project-first seed because RUN_PROJECT_FIRST_SEED is not true"
fi

exec npm start
