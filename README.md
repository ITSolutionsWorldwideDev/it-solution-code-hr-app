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

It is used for website-side publication data, especially:

- `jobs_infos`

### Database bootstrap behavior

There are no formal migrations in this repository.
Instead, the backend currently relies on runtime bootstrap helpers in [app/db.py](app/db.py) and parts of [app/services/settings_service.py](app/services/settings_service.py).

Current bootstrap behavior includes:

- `SQLModel.metadata.create_all(...)`
- `jobs_infos` table bootstrap in the website database
- user auth columns bootstrap
- default departments bootstrap
- vacancy apply-link backfill for existing vacancies
- settings schema bootstrap

This is important for new developers: schema changes are currently applied in code, not through Alembic migrations.

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

- [app/services/website_publish_service.py](app/services/website_publish_service.py)
- [app/models/website_publication.py](app/models/website_publication.py)

The main idea:

- a vacancy is mapped to a website-side publication record
- website job content can be pushed to the website database

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
AUTH_JWT_SECRET=replace-with-a-long-random-secret
INTERNAL_LOGIN_PASSWORD=ITWW123
AUTH_COOKIE_SECURE=0
UPLOADTHING_APP_ID=...
UPLOADTHING_SECRET=...
UPLOADTHING_TOKEN=...
VERTEX_PROJECT_ID=...
VERTEX_LOCATION=europe-west1
VERTEX_GENERATIVE_MODEL=gemini-2.0-flash
VERTEX_GENERATIVE_MODELS=gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-pro
VERTEX_EMBEDDING_MODEL=text-embedding-004
N8N_HR_INVITE_WEBHOOK_URL=http://localhost:5678/webhook/hr-approval-email
N8N_WEBHOOK_SECRET=development-n8n-secret
N8N_LINKEDIN_PREVIEW_WEBHOOK_URL=http://localhost:5678/webhook/linkedin-preview-v2
N8N_CALENDAR_AVAILABILITY_WEBHOOK_URL=http://localhost:5678/webhook/calendar-availability
CAL_COM_BOOKING_BASE_URL=https://your-org.cal.com/hr-intake
CAL_COM_WEBHOOK_SECRET=...
PUBLIC_APPLY_BASE_URL=http://localhost:3000/apply
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

- `PUBLIC_APPLY_BASE_URL` is normalized by code in some flows and may end up behaving as a `/careers/...` base for public links

### Frontend

Main frontend variable:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

If not set, the frontend falls back to:

- `https://it-solution-code-hr-app-backend.vercel.app/api`

## Deployment Notes

### Vercel

The frontend is deployed on Vercel.
The backend can also run hosted and is expected to be reachable by the frontend through `NEXT_PUBLIC_API_BASE_URL`.

Important deployment caveats:

- the frontend and backend may run on different Vercel domains
- auth therefore depends on correct cookie settings
- Vercel serverless runtime only allows writing to `/tmp`
- local storage paths are different from hosted paths

That is why:

- resume storage falls back to `/tmp/resumes` on Vercel
- website PDF output falls back to `/tmp/job-pdfs` on Vercel

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
