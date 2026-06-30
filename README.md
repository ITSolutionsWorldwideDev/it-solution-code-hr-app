# Talent Genie / IT Solutions Worldwide Recruitment Platform

This repository contains the current internal recruitment platform used to manage:

- hiring requests
- AI-generated job descriptions
- vacancies
- public careers pages and application intake
- candidate parsing and matching
- shortlist and pipeline workflows
- LinkedIn post previews
- website publishing and branded website PDF generation
- lightweight internal login and personal settings

The codebase is split into a FastAPI backend and a Next.js frontend. There are also older or secondary apps in the repository, but the main product lives in `app/` and `frontend/`.

## Current Architecture

### Main backend

The backend lives in `app/` and is built with:

- `FastAPI`
- `SQLModel` / SQLAlchemy
- `PostgreSQL`
- `PyJWT`
- `ReportLab`
- `pypdf`

Main entrypoints:

- [app/main.py](app/main.py)
- [app/config.py](app/config.py)
- [app/db.py](app/db.py)
- [app/routes/__init__.py](app/routes/__init__.py)

### Main frontend

The frontend lives in `frontend/` and is built with:

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Tailwind CSS`

Main entrypoints:

- [frontend/app/layout.tsx](frontend/app/layout.tsx)
- [frontend/next.config.ts](frontend/next.config.ts)
- [frontend/lib/api/client.ts](frontend/lib/api/client.ts)

### Secondary folders

These folders exist, but they are not the primary internal app:

- `itww-admin/`
  Secondary website/admin app code. Keep it only if you need the separate website-side logic.
- `design-sandbox/`
  UI sandbox / experiments.
- `storage/`
  Local output for resumes and generated PDFs.
- `resumes/`
  Local resume samples or working files.

## What The Product Does Today

The platform currently supports this end-to-end flow:

1. A hiring request is created and approved.
2. Approval creates a vacancy.
3. AI can generate or refine the vacancy/job description.
4. The vacancy can be published to the website database.
5. A branded website PDF can be generated from the vacancy JD.
6. A LinkedIn preview can be generated for the vacancy.
7. Public candidates apply through the careers/apply flow.
8. CVs are stored, parsed, matched, and surfaced to recruiters.
9. Recruiters review candidates in shortlist and pipeline views.
10. Interview scheduling and reminders are supported through integrations.

## Repository Layout

```text
.
|- app/                    FastAPI backend
|- frontend/               Next.js internal frontend
|- itww-admin/             Secondary website/admin app
|- design-sandbox/         UI sandbox
|- storage/                Local generated files
|- resumes/                Local resume files
|- requirements.txt        Python dependencies
`- README.md               This document
```

## Backend Overview

### Route groups

All backend routes are mounted under `/api`.

Current route groups:

- `/api/auth`
- `/api/settings`
- `/api/users`
- `/api/departments`
- `/api/employees`
- `/api/hiring-requests`
- `/api/vacancies`
- `/api/candidates`
- `/api/applications`
- `/api/interviews`
- `/api/integrations/n8n`
- `/api/website-integrations`
- `/api/website-public`
- `/api/webhooks`
- `/api/dashboard`

Interactive docs:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/redoc`

### Important backend models

Main data models in `app/models/`:

- `User`
- `UserPreference`
- `AppSetting`
- `Department`
- `HiringRequest`
- `Vacancy`
- `Candidate`
- `Application`
- `ApplicationStageEvent`
- `ApplicationInterview`
- `ApplicationEmailEvent`
- `CandidateMatch`
- `PotentialMatch`
- `CandidateRoleSuggestion`
- `ParseJob`
- `WebsitePublication`

### Important backend services

Core services you will touch most often:

- [app/services/openai_service.py](app/services/openai_service.py)
  JD generation and JD apply-link injection helpers.
- [app/services/linkedin_service.py](app/services/linkedin_service.py)
  LinkedIn preview/publish payload normalization.
- [app/services/website_publish_service.py](app/services/website_publish_service.py)
  Website publication flow.
- [app/services/website_pdf_service.py](app/services/website_pdf_service.py)
  Website PDF generation with the branded letterhead template.
- [app/services/application_workflow_service.py](app/services/application_workflow_service.py)
  Application stage transitions and shortlist logic.
- [app/services/candidate_service.py](app/services/candidate_service.py)
  Candidate creation, parsing support, and matching flows.
- [app/services/talent_discovery_service.py](app/services/talent_discovery_service.py)
  Hidden talent and candidate discovery.
- [app/services/settings_service.py](app/services/settings_service.py)
  App settings defaults, personal settings, and runtime access behavior.
- [app/services/auth_service.py](app/services/auth_service.py)
  JWT cookie auth helpers.
- [app/services/vacancy_service.py](app/services/vacancy_service.py)
  Vacancy cleanup and vacancy apply-link backfill helpers.

## Frontend Overview

### Main app routes

Current important frontend routes in `frontend/app/`:

- `/login`
- `/dashboard`
- `/hiring-requests`
- `/vacancies`
- `/vacancies/[id]`
- `/candidates`
- `/shortlisted`
- `/pipeline`
- `/pipeline/[id]`
- `/onboarding`
- `/departments`
- `/organogram`
- `/settings`

Public routes:

- `/jobs`
- `/careers/[id]`
- `/apply/[id]`
- `/candidate/schedule/[applicationId]`

### Important frontend areas

- `frontend/components/recruitment/`
  Main recruitment product UI.
- `frontend/components/dashboard/`
  Dashboard views and summary cards.
- `frontend/components/layout/`
  Sidebar, top bar, and shell.
- `frontend/components/auth/`
  Internal login flow.
- `frontend/components/settings/`
  Personal settings page.
- `frontend/components/providers/role-provider.tsx`
  Session hydration and auth-aware frontend state.
- `frontend/lib/api/client.ts`
  Shared fetch wrapper with `credentials: "include"`.
- `frontend/lib/session.ts`
  Frontend role/session helpers.

## Authentication

### Current auth model

The app currently uses a lightweight internal login model.

Important behavior:

- there is one shared internal password
- the password comes from `INTERNAL_LOGIN_PASSWORD`
- users log in with an email address plus the shared password
- the backend validates email format and password
- the backend issues an HTTP-only JWT cookie
- users are auto-created in the `user` table on first successful login
- auto-created users default to role `HR` unless changed in data/settings

Important files:

- [app/routes/auth.py](app/routes/auth.py)
- [app/services/auth_service.py](app/services/auth_service.py)
- [frontend/components/auth/login-home.tsx](frontend/components/auth/login-home.tsx)
- [frontend/components/providers/role-provider.tsx](frontend/components/providers/role-provider.tsx)

### Live Vercel auth note

The hosted frontend and hosted backend run on separate Vercel domains.
Because of that, the backend now forces hosted auth cookies to:

- `Secure = true`
- `SameSite = none`

That logic lives in [app/services/settings_service.py](app/services/settings_service.py).

If settings or authenticated API calls work locally but fail on Vercel, start by checking cookie behavior and cross-domain frontend/backend configuration.

## Settings

### Current state

The backend contains a broader settings system, but the frontend intentionally exposes only a small personal settings page today.

Current `/settings` UI:

- `Profile`
  - full name
  - email (read-only)
  - preferred display name
  - default landing page
- `Preferences`
  - default landing page
  - reduced motion

Important behavior:

- preferred display name updates the visible workspace name
- default landing page is used after login when there is no explicit `next` route
- reduced motion updates frontend behavior through `html[data-reduced-motion="true"]`

Important files:

- [frontend/app/settings/page.tsx](frontend/app/settings/page.tsx)
- [frontend/components/settings/settings-page.tsx](frontend/components/settings/settings-page.tsx)
- [app/routes/settings.py](app/routes/settings.py)
- [app/services/settings_service.py](app/services/settings_service.py)

### Important implementation note

The settings page uses `useSearchParams()`, so the page route wraps the client component in `Suspense` to satisfy production builds.

## Databases

### 1. Main HR database

This is the main backend database from `DATABASE_URL`.

It stores:

- users
- preferences
- hiring requests
- vacancies
- candidates
- applications
- interviews
- stage history
- AI match records
- website publication mappings

### 2. Website database

Optional second database from `WEBSITE_DATABASE_URL`.

It is used for website-side publication and website-side intake data, especially:

- `jobs_infos`
- `job_applications`
- website-side `users`

Important production detail:

- `DATABASE_URL` and `WEBSITE_DATABASE_URL` are often **different databases**
- `DATABASE_URL` should point to the HR platform database
- `WEBSITE_DATABASE_URL` should point to the ITWW website database
- if `WEBSITE_DATABASE_URL` is missing, code falls back to `DATABASE_URL`

Important website publication detail:

- `jobs_infos.created_by` must reference a real `users.user_id` in the **website database**
- the value comes from `WEBSITE_PUBLISHER_USER_ID`
- if that user id does not exist, website publish fails with an `IntegrityError`

### Database bootstrap behavior

There are no formal migrations in this repository.
Instead, the backend currently relies on runtime bootstrap helpers in [app/db.py](app/db.py) and parts of [app/services/settings_service.py](app/services/settings_service.py).

Current bootstrap behavior includes:

- `SQLModel.metadata.create_all(...)`
- `jobs_infos` table bootstrap in the website database
- candidate resume/blob storage bootstrap
- `parse_jobs` file/blob storage bootstrap
- user auth columns bootstrap
- default departments bootstrap
- vacancy apply-link backfill for existing vacancies
- settings schema bootstrap

This is important for new developers: schema changes are currently applied in code, not through Alembic migrations.

Important startup behavior:

- locally, the backend runs `init_db()` in a background thread on startup
- on Vercel, `init_db()` only runs when `RUN_DB_INIT_ON_STARTUP=1`
- if you restore or move a database and the app suddenly misses columns, tables, or default data, start by enabling `RUN_DB_INIT_ON_STARTUP=1` for one backend deploy

## Job Description, LinkedIn, And Apply Links

### JD generation

The job description pipeline uses AI plus fallback logic in [app/services/openai_service.py](app/services/openai_service.py).

Important detail:

- the platform injects a `How to Apply` section into job descriptions
- the apply link is meant to point to the public careers/apply route for the vacancy

### LinkedIn preview

LinkedIn preview generation is handled through:

- [app/routes/integrations.py](app/routes/integrations.py)
- [app/services/linkedin_service.py](app/services/linkedin_service.py)
- [frontend/components/recruitment/linkedin-preview-card.tsx](frontend/components/recruitment/linkedin-preview-card.tsx)

Important current behavior:

- placeholders such as `[PLAK HIER JE URL]`, `[Application Link]`, and legacy approval placeholders are normalized
- the backend now self-heals missing apply links on vacancy read/create/update
- backend startup backfills existing vacancy descriptions with real apply links

If a LinkedIn JD looks wrong, start by inspecting:

- the vacancy `description`
- the generated `apply_url`
- `inject_job_description_apply_url(...)`
- `_normalize_linkedin_post_text(...)`

## Website Publishing And PDF Generation

### Website publication

Website publication is handled by:

- [app/routes/website_integrations.py](app/routes/website_integrations.py)
- [app/services/website_publish_service.py](app/services/website_publish_service.py)
- [app/models/website_publication.py](app/models/website_publication.py)
- [app/services/uploadthing_service.py](app/services/uploadthing_service.py)

The main idea:

- the frontend triggers `POST /api/integrations/website/publish`
- the backend loads the HR vacancy from the HR database
- the backend generates an ITWW-style PDF
- the backend uploads that PDF to UploadThing and gets back a public URL
- the backend writes or updates `jobs_infos` in the website database
- the backend stores the HR-to-website mapping in `website_publication`

Important environment variables for this flow:

- `WEBSITE_DATABASE_URL`
- `WEBSITE_JOBS_TABLE` (normally `jobs_infos`)
- `WEBSITE_PUBLISHER_USER_ID`
- `UPLOADTHING_APP_ID`
- `UPLOADTHING_SECRET`
- `UPLOADTHING_TOKEN`

Important current constraints we validated during debugging:

- `jobs_infos.title` is unique in the current website database
- duplicate title rows can therefore trigger `IntegrityError`
- `created_by` must point to a real website-side user id
- if publish keeps failing after an env change, confirm the backend was actually redeployed and is not still running with old values

### Website PDF generation

Website PDF generation is handled by:

- [app/services/website_pdf_service.py](app/services/website_pdf_service.py)

Current important behavior:

- uses `Letter Head ITWW HD.pdf`
- removes markdown artifacts before rendering
- uses branded layout and typography
- keeps text positioned clear of the header artwork
- caches template-derived assets when needed

## Public Candidate Flow

### Public careers and apply pages

The public-facing frontend routes are:

- `/jobs`
- `/careers/[id]`
- `/apply/[id]`

Important files:

- [frontend/app/jobs/page.tsx](frontend/app/jobs/page.tsx)
- [frontend/app/careers/[id]/page.tsx](frontend/app/careers/[id]/page.tsx)
- [frontend/app/apply/[id]/page.tsx](frontend/app/apply/[id]/page.tsx)
- [frontend/components/recruitment/public-apply-form.tsx](frontend/components/recruitment/public-apply-form.tsx)

### Public application intake

The backend receives public submissions through:

- [app/routes/applications.py](app/routes/applications.py)

That flow stores:

- uploaded CV data
- candidate details
- the application record
- downstream parsing/matching information

Current important behavior:

- the canonical public base is now effectively `/careers/...`
- `POST /api/applications/public-submit` also accepts `legacy_application_id` and `website_job_info_id`
- the website/admin app can forward legacy website applications directly into the HR backend without relying on an n8n polling loop
- there is also a backend-side recovery endpoint `POST /api/integrations/website/sync-applications` for syncing `job_applications` rows from the website DB into the HR app

Important files:

- [app/services/application_service.py](app/services/application_service.py)
- [app/services/website_application_sync_service.py](app/services/website_application_sync_service.py)
- [itww-admin/src/app/api/jobs-application/route.ts](itww-admin/src/app/api/jobs-application/route.ts)

## Running Locally

### Backend

From the repository root:

```powershell
cd "C:\Coding Projects\IT Solution Code"
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### Frontend

In a second terminal:

```powershell
cd "C:\Coding Projects\IT Solution Code\frontend"
npm install
npm run dev
```

Default URLs:

- frontend: `http://localhost:3000`
- backend API docs: `http://127.0.0.1:8000/docs`
- backend health: `http://127.0.0.1:8000/health`

## Frontend Build Notes

### Dev indicators

The Next.js dev indicator popup is disabled in:

- [frontend/next.config.ts](frontend/next.config.ts)

Current config:

- `devIndicators: false`

### Local API rewrite

The frontend rewrites `/backend-api/*` to the local FastAPI server in development:

- `/backend-api/:path* -> http://127.0.0.1:8000/api/:path*`

This allows the browser to keep working even when the frontend is opened through a different local host/device name.

## Environment Variables

### Backend

Primary backend variables from `.env` / `.env.example`:

```env
DATABASE_URL=postgresql+psycopg://...
WEBSITE_DATABASE_URL=postgresql+psycopg://...
WEBSITE_JOBS_TABLE=jobs_infos
WEBSITE_PUBLISHER_USER_ID=1
RUN_DB_INIT_ON_STARTUP=0
AUTH_JWT_SECRET=replace-with-a-long-random-secret
INTERNAL_LOGIN_PASSWORD=ITWW123
AUTH_COOKIE_SECURE=0
UPLOADTHING_APP_ID=...
UPLOADTHING_SECRET=...
UPLOADTHING_TOKEN=...
VERTEX_PROJECT_ID=...
VERTEX_LOCATION=europe-west1
VERTEX_GENERATIVE_MODEL=gemini-3.1-flash-lite
VERTEX_GENERATIVE_MODELS=gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-2.5-flash,gemini-2.5-pro,gemini-2.0-flash
VERTEX_EMBEDDING_MODEL=gemini-embedding-001
N8N_HR_INVITE_WEBHOOK_URL=http://localhost:5678/webhook/hr-approval-email
N8N_WEBHOOK_SECRET=development-n8n-secret
N8N_LINKEDIN_PREVIEW_WEBHOOK_URL=http://localhost:5678/webhook/linkedin-preview-v2
N8N_CALENDAR_AVAILABILITY_WEBHOOK_URL=http://localhost:5678/webhook/calendar-availability
CAL_COM_BOOKING_BASE_URL=https://your-org.cal.com/hr-intake
CAL_COM_WEBHOOK_SECRET=...
PUBLIC_APPLY_BASE_URL=http://localhost:3000/careers
PUBLIC_SCHEDULE_BASE_URL=http://localhost:3000/candidate/schedule
PUBLIC_SCHEDULE_TIMEZONE=Europe/Amsterdam
PUBLIC_SCHEDULE_DAYS_AHEAD=14
PUBLIC_SCHEDULE_SLOT_MINUTES=30
PUBLIC_SCHEDULE_BUSINESS_START_HOUR=9
PUBLIC_SCHEDULE_BUSINESS_END_HOUR=17
RESUME_UPLOAD_DIR=storage/resumes
WEBSITE_PDF_OUTPUT_DIR=storage/website-job-pdfs
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,...
```

Important note:

- `DATABASE_URL` should point to the HR database, not the website database
- `WEBSITE_DATABASE_URL` should point to the website database when website publication or website-side apply sync is in use
- `RUN_DB_INIT_ON_STARTUP=1` is useful for the first Vercel deploy after restoring or moving a database
- `PUBLIC_APPLY_BASE_URL` should be treated as a `/careers/...` base for public links

### Frontend

Main frontend variables:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_PUBLIC_APPLY_BASE_URL=http://localhost:3000/careers
```

If not set, the frontend falls back to:

- `https://it-solution-code-hr-app-backend.vercel.app/api`

Important behavior:

- in the browser, a localhost-style `NEXT_PUBLIC_API_BASE_URL` is rewritten to `/backend-api` for local development
- if this value is wrong or the backend is unreachable, some screens show explicit fetch errors, while the dashboard may simply fall back to zeros

### Secondary app (`itww-admin`)

Important variables for the secondary admin/website app:

```env
DATABASE_URL=postgresql+psycopg://...
HR_BACKEND_API_BASE_URL=https://it-solution-code-hr-app-backend.vercel.app/api
UPLOADTHING_APP_ID=...
UPLOADTHING_SECRET=...
UPLOADTHING_TOKEN=...
```

Important note:

- `itww-admin` usually talks to the website database, not the HR database
- if the website/admin project reads `jobs_infos` and `job_applications`, its `DATABASE_URL` should stay pointed at the website DB

## Deployment Notes

### Vercel

The repo is usually deployed as multiple Vercel projects:

- the main frontend
- the FastAPI backend
- the optional `itww-admin` website/admin app

The frontend is expected to reach the backend through `NEXT_PUBLIC_API_BASE_URL`.

Important deployment caveats:

- the frontend and backend may run on different Vercel domains
- auth therefore depends on correct cookie settings
- Vercel serverless runtime only allows writing to `/tmp`
- local storage paths are different from hosted paths

That is why:

- resume storage falls back to `/tmp/resumes` on Vercel
- website PDF output falls back to `/tmp/job-pdfs` on Vercel

Useful hosted endpoints:

- backend health: `/health`
- backend docs: `/docs`

If a new database is connected on Vercel and the app still behaves like the old one:

1. confirm the env vars were saved in the correct project
2. redeploy the project
3. temporarily enable `RUN_DB_INIT_ON_STARTUP=1` for the backend

## Troubleshooting

### Dashboard shows zeros even though the database has data

This does not always mean the HR database is empty.

Current frontend behavior:

- some dashboard fetches fall back to empty arrays / zero-like values when the API request fails
- more explicit screens may show `Could not reach the API: Failed to fetch`

Start by checking:

- `NEXT_PUBLIC_API_BASE_URL`
- backend `/health`
- backend `/docs`
- browser Network tab for failed API requests

### `Publish to Website` fails with `IntegrityError`

The most common current causes are:

- `WEBSITE_DATABASE_URL` points to the wrong database
- `WEBSITE_PUBLISHER_USER_ID` does not exist in the website DB `users` table
- `jobs_infos.title` already exists and the unique title constraint rejects the insert
- the backend was not redeployed after changing environment variables

Helpful checks:

- verify a manual insert into `jobs_infos` works with the chosen `created_by`
- check whether the same title already exists in `jobs_infos`
- check the HR-side `website_publication` mapping table

### Public website applications are not appearing inside the HR app

Current recovery path:

- confirm `WEBSITE_DATABASE_URL` points to the real website DB
- confirm the website/admin app forwards `legacy_application_id` and `website_job_info_id`
- use `POST /api/integrations/website/sync-applications` to backfill or recover website-side applications without relying on an n8n polling workflow

## Known Current Constraints

- The backend uses runtime schema bootstrap instead of formal migrations.
- The internal login model is intentionally lightweight and not enterprise-grade yet.
- The frontend only exposes personal settings even though the backend has broader settings infrastructure.
- There are multiple apps and older folders in the repository; not all of them are equally current.
- Public/site integration logic is spread across the backend and secondary website-side code.

## Recommended Starting Points For New Developers

If you are new to the codebase, read these first:

1. [app/main.py](app/main.py)
2. [app/config.py](app/config.py)
3. [app/db.py](app/db.py)
4. [app/routes/__init__.py](app/routes/__init__.py)
5. [frontend/lib/api/client.ts](frontend/lib/api/client.ts)
6. [frontend/components/providers/role-provider.tsx](frontend/components/providers/role-provider.tsx)
7. [frontend/components/recruitment/vacancy-detail.tsx](frontend/components/recruitment/vacancy-detail.tsx)
8. [frontend/components/recruitment/linkedin-preview-card.tsx](frontend/components/recruitment/linkedin-preview-card.tsx)
9. [app/services/openai_service.py](app/services/openai_service.py)
10. [app/services/settings_service.py](app/services/settings_service.py)

## Maintenance Guidance

When making changes, be especially careful around:

- auth cookie behavior
- apply-link generation
- website publication fields
- public route URL bases
- Vercel-only path behavior
- settings bootstrap side effects

Those are the parts of the system most likely to break across environments.
