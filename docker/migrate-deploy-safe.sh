#!/bin/sh
# Data-safe Prisma migrations for ECS startup.
# - Uses `prisma migrate deploy` for pending migrations only.
# - On P3005 (existing schema, no migration history): marks migrations as applied
#   via `migrate resolve --applied` — updates _prisma_migrations only; never runs
#   CREATE/DROP/TRUNCATE SQL against your data tables.
set -e

baseline_existing_schema() {
  echo "P3005: existing schema detected — baselining migration history only (no data or tables changed)."
  for dir in prisma/migrations/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    [ -f "$dir/migration.sql" ] || continue
    echo "  -> prisma migrate resolve --applied $name"
    npx prisma migrate resolve --applied "$name"
  done
}

run_migrate_deploy() {
  ./node_modules/.bin/prisma migrate deploy
}

run_migrate_deploy_with_retry() {
  max_attempts=6
  attempt=1

  while :; do
    if migrate_output=$(run_migrate_deploy 2>&1); then
      printf '%s\n' "$migrate_output"
      return 0
    fi

    printf '%s\n' "$migrate_output"

    if printf '%s' "$migrate_output" | grep -q 'P3005'; then
      return 1
    fi

    if [ "$attempt" -ge "$max_attempts" ]; then
      return 1
    fi

    attempt=$((attempt + 1))
    sleep 10
  done
}

if ! migrate_output=$(run_migrate_deploy_with_retry 2>&1); then
  if printf '%s' "$migrate_output" | grep -q 'P3005'; then
    baseline_existing_schema
    run_migrate_deploy
  else
    exit 1
  fi
else
  printf '%s\n' "$migrate_output"
fi
