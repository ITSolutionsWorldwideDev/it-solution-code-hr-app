# Company Database Migration Guide

This project currently uses more than one database integration. Do not move everything blindly to a single URL without deciding ownership first.

## Current DB map

### 1. Recruitment backend database

Used by the FastAPI backend in `app/`.

- Config source: `DATABASE_URL`
- Code:
  - `app/config.py`
  - `app/db.py`
- Holds:
  - departments
  - users
  - hiring requests
  - vacancies
  - candidates
  - applications
  - interviews
  - related workflow data

### 2. Website/admin database

Used by the website publishing flow and by `itww-admin`.

- Config source in backend: `WEBSITE_DATABASE_URL`
- Config source in `itww-admin`: `DATABASE_URL`
- Code:
  - `app/services/website_publish_service.py`
  - `itww-admin/prisma/schema.prisma`
  - `itww-admin/src/lib/db.ts`
  - `itww-admin/src/lib/prisma.ts`
- Holds:
  - `jobs_infos`
  - admin users for `itww-admin`
  - blogs

## Recommended target setup

Use company-owned infrastructure and keep logical separation:

1. `company-recruitment-db`
   - for FastAPI backend operational data
   - wired to backend `DATABASE_URL`

2. `company-website-admin-db`
   - for website publishing and `itww-admin`
   - wired to backend `WEBSITE_DATABASE_URL`
   - wired to `itww-admin` `DATABASE_URL`

This can be:

- two separate Postgres databases, or
- one Postgres cluster with two separate databases

Two databases is safer and clearer.

## Migration order

1. Provision the new company Postgres database(s)
2. Export data from the old database(s)
3. Import data into the new database(s)
4. Update environment variables
5. Redeploy backend and admin
6. Verify reads/writes in production
7. Only then retire the old database(s)

## What to migrate

### Backend DB export/import

Move the current recruitment app data from the old backend database to the new backend database.

Typical command shape:

```powershell
pg_dump "postgresql://OLD_USER:OLD_PASS@OLD_HOST:5432/OLD_DB?sslmode=require" `
  --format=custom `
  --file backend-db.dump
```

Restore:

```powershell
pg_restore `
  --no-owner `
  --no-privileges `
  --dbname "postgresql://NEW_USER:NEW_PASS@NEW_HOST:5432/NEW_DB?sslmode=require" `
  backend-db.dump
```

### Website/admin DB export/import

Move the website/admin data separately.

Typical command shape:

```powershell
pg_dump "postgresql://OLD_USER:OLD_PASS@OLD_HOST:5432/OLD_DB?sslmode=require" `
  --format=custom `
  --file website-admin-db.dump
```

Restore:

```powershell
pg_restore `
  --no-owner `
  --no-privileges `
  --dbname "postgresql://NEW_USER:NEW_PASS@NEW_HOST:5432/NEW_DB?sslmode=require" `
  website-admin-db.dump
```

## Environment variables to update

### Backend on Vercel

Set these on the backend project:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/RECRUITMENT_DB?sslmode=require
WEBSITE_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/WEBSITE_ADMIN_DB?sslmode=require
```

Notes:

- The backend normalizes `postgresql://` and `postgres://`, but using `postgresql+psycopg://` is the clearest option here.
- The backend currently fails hard on startup if `DATABASE_URL` is unreachable.

### `itww-admin`

Set:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/WEBSITE_ADMIN_DB?sslmode=require
```

Prisma expects the standard Postgres URL form here.

## Verification checklist

After migration:

1. Backend `/health` responds
2. Backend `/api/departments/` works
3. Backend `/api/vacancies/` works
4. Backend can create and read candidates/applications
5. `itww-admin` can load `jobs_infos`
6. Website publish action inserts/updates records in `jobs_infos`
7. Blog pages in `itww-admin` still load

## Important security note

The previous file `itww-admin/env 10` contained real credentials and should not live in the repository.

Required follow-up:

1. Rotate the exposed database credentials immediately
2. Replace them in Vercel / admin environments
3. Verify no old leaked credentials remain active

## Suggested execution plan

### Phase 1

- provision company database(s)
- rotate leaked credentials

### Phase 2

- export old data
- import into new database(s)

### Phase 3

- update Vercel backend env vars
- update `itww-admin` env vars
- redeploy

### Phase 4

- verify production
- decommission old DB access
