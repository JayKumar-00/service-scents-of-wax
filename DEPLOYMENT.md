# giftfactory-api — deployment checklist

## Endpoints (ALB / ECS / Prometheus)

| Path | Purpose | Auth |
|------|---------|------|
| `GET /api/v1/health` | Liveness | Public |
| `GET /api/v1/health/live` | Liveness (ALB + Docker health check) | Public |
| `GET /api/v1/health/ready` | Readiness (Postgres + Valkey ping) | Public |
| `GET /api/v1/metrics` | Prometheus scrape (`METRICS_ENABLED=true`) | Public |

Health and metrics responses are **not** wrapped by the API envelope.

## Bind address

- `HOST=0.0.0.0` (default in `main.ts`, Dockerfile, entrypoint)
- `PORT=3000` (must match ALB target group and ECS `containerPort`)

## Required environment variables (ECS / per env)

| Variable | Development | Production |
|----------|---------------|------------|
| `APP_ENV` | `development` | `production` |
| `NODE_ENV` | `production` | `production` |
| `HOST` | `0.0.0.0` | `0.0.0.0` |
| `PORT` | `3000` | `3000` |
| `METRICS_ENABLED` | `true` | `true` |
| `WRITER_DB_URL` | dev RDS writer | prod RDS writer |
| `READER_DB_URL` | dev RDS reader | prod RDS reader |
| `DATABASE_URL` / `DIRECT_URL` | same as writer (Prisma) | same as writer |
| `JWT_SECRET` | ECS env (from Terraform / `api_jwt_secret`) | required at startup |
| `BREVO_API_KEY` | ECS env (`api_brevo` in tfvars) | email/SMS |
| `RAZORPAY_*` | ECS env (`api_razorpay` in tfvars) | payments |
| `REDIS_URI` | Valkey primary endpoint | Valkey primary endpoint |
| `REDIS_PORT` | `6379` | `6379` |
| `REDIS_DB` | `0` | `1` |
| `CORS_ORIGINS` | include dev frontends | include prod frontends |
| `JWT_SECRET` | from Secrets Manager | from Secrets Manager |

Terraform sets DB/Redis/CORS for each ECS service; add JWT and third-party keys manually in Secrets Manager or task env.

## GitHub Actions (this repo)

`.github/workflows/deploy.yml`:

| Branch | ECR tag | ECS service |
|--------|---------|-------------|
| `dev` | `dev-latest` | `giftfactory-api-development` |
| `main` | `prod-latest` | `giftfactory-api-production` |

Secrets in **this** GitHub repo: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

## Prometheus & Grafana

- **Prometheus** scrapes `http://api-<env>.giftfactory.local:3000/api/v1/metrics` (see `infra/observability` repo).
- **Grafana** is a separate ECS service; datasource points at Prometheus.
- API does not run Grafana/Prometheus — only exposes metrics.

## Pre-deploy

```bash
npx prisma generate
npm run build   # fix any Prisma/TS errors before pushing
```

## Database migrations

Migrations are **not** run in GitHub Actions. Each ECS task runs them on startup via `docker/entrypoint.sh` (`npx prisma migrate deploy`), then starts the API.

Flow: push `dev` / `main` → Actions builds image → pushes ECR → ECS rolling deploy → new tasks migrate + serve.

Manual migrate (when you have network access to RDS writer):

```bash
export WRITER_DB_URL='postgresql://...'
export DATABASE_URL="$WRITER_DB_URL"
export DIRECT_URL="$WRITER_DB_URL"
npx prisma migrate deploy
npx prisma migrate status
```

If a migration failed mid-run (P3009), resolve once against the writer, then redeploy:

```bash
npx prisma migrate resolve --rolled-back <migration_name>
npx prisma migrate deploy
```

### P3005 — database already has schema (Neon copy / db push)

ECS logs show `P3005` and `The database schema is not empty` when RDS has tables but no
`_prisma_migrations` history (common after copying Neon data into RDS).

**This fix does not delete data.** `docker/migrate-deploy-safe.sh` only runs
`prisma migrate resolve --applied`, which records migration names in
`_prisma_migrations` without executing CREATE/DROP/TRUNCATE SQL.

Manual baseline (same behavior, no data loss):

```bash
export WRITER_DB_URL='postgresql://...rds-writer.../giftfactory_dev?sslmode=require'
./scripts/baseline-database.sh
```

### Avoid accidental data loss

Never use these on a populated RDS unless you intend to wipe data:

| Flag | Effect | Required |
|------|--------|----------|
| `TRUNCATE_TARGET=1` | Deletes all rows | `ALLOW_DATA_LOSS=1` |
| `RESET_TARGET=1` | `DROP SCHEMA public CASCADE` | `ALLOW_DATA_LOSS=1` |

Safe Neon → RDS copy (keeps existing data, appends rows):

```bash
MODE=data-only SOURCE_DB_URL='...neon...' TARGET_DB_URL='...rds...' ./scripts/copy-database.sh
```

Sync migration history only (fixes P3005, no table changes):

```bash
RUN_MIGRATE=1 MODE=data-only SOURCE_DB_URL='...' TARGET_DB_URL='...' ./scripts/copy-database.sh
```
