#!/bin/sh
set -e

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"

if [ -n "${WRITER_DB_URL:-}" ]; then
  export DATABASE_URL="${DATABASE_URL:-$WRITER_DB_URL}"
  export DIRECT_URL="${DIRECT_URL:-$WRITER_DB_URL}"
fi

# Data-safe migrations only — never reset, drop, or truncate the database.
sh /migrate-deploy-safe.sh

exec node dist/main.js
