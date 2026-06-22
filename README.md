# AI Recruitment Platform

This repository contains a full recruitment workflow tool with:

- a `FastAPI` backend for hiring, vacancies, candidates, applications, interviews, and AI-assisted processing
- a `Next.js` frontend for HR and hiring-team workflows
- `n8n` integrations for LinkedIn posting, HR email delivery, and calendar-backed interview availability
- `Vertex AI / Gemini` integrations for job-description drafting, CV parsing support, and talent discovery

The project is built to support the full path from hiring request to published vacancy to candidate intake and pipeline review.

## What The Tool Does

At a high level, the platform helps a team:

1. Create and approve hiring requests
2. Turn approved requests into vacancies
3. Draft vacancy text with AI support
4. Publish or preview vacancy copy for LinkedIn through `n8n`
5. Accept public applications and CV uploads
6. Parse CVs and connect candidates to vacancies
7. Review candidates inside a shortlist and pipeline workflow
8. Surface hidden-potential candidates through AI matching and discovery

## Repository Layout

```text
.
|- app/                    FastAPI backend
|- frontend/               Next.js frontend
|- itww-admin/             Website/admin app and website application bridge routes
|- design-sandbox/         Separate frontend-only UI sandbox
|- scripts/                Utility scripts
|- storage/                Uploaded files and generated assets
|- resumes/                Sample or working resume files
|- requirements.txt        Python dependencies
`- README.md               This file
```

## Architecture

### Frontend

The frontend lives in `frontend/` and uses:

- `Next.js 15` App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS`

It is organized into three main layers:

- `frontend/app/`
  Route entrypoints such as `/vacancies`, `/pipeline`, `/shortlisted`, `/apply/[id]`, and `/dashboard/*`
- `frontend/components/`
  Reusable UI and feature components such as recruitment pages, dashboard shells, login screens, and shared controls
- `frontend/lib/`
  API client code, session helpers, mock data, and TypeScript record shapes

Important frontend areas:

- `frontend/components/recruitment/`
  Main hiring product UI, including vacancy details, candidate upload, shortlist, pipeline, LinkedIn preview, and public apply flows
- `frontend/components/layout/`
  Shared app shell, sidebar, top bar, and dashboard frame
- `frontend/lib/api/client.ts`
  Shared fetch wrapper used to talk to the backend API

### Backend

The backend lives in `app/` and uses:

- `FastAPI`
- `SQLAlchemy / SQLModel`
- `PostgreSQL`
- `Pydantic`

It is organized into the usual API layers:

- `app/models/`
  Database models
- `app/schemas/`
  Request and response shapes
- `app/routes/`
  API endpoints
- `app/services/`
  Business logic, AI integration, workflow logic, and third-party calls
- `app/config.py`
  Environment-driven settings
- `app/main.py`
  FastAPI entrypoint and CORS setup

Important backend areas:

- `app/routes/hiring_requests.py`
  Hiring request lifecycle
- `app/routes/vacancies.py`
  Vacancy CRUD and vacancy-related actions
- `app/routes/candidates.py`
  Candidate intake, CV parsing, and matching
- `app/routes/applications.py`
  Application and pipeline actions
- `app/routes/integrations.py`
  `n8n` webhook endpoints and LinkedIn preview/publish trigger
- `app/services/linkedin_service.py`
  Backend call to the `n8n` LinkedIn webhook
- `app/services/hr_invite_service.py`
  HR invite workflow callbacks
- `app/services/ai_service.py`
  AI-backed extraction and generation logic
- `app/services/talent_discovery_service.py`
  Hidden-potential and discovery workflows

### Website/Admin App

The repository also contains `itww-admin/`, which is the separate website/admin-side
application used for website job publishing and website-side application intake.

Important website/admin areas:

- `itww-admin/src/app/api/jobs-application/route.ts`
  Website job application API with forwarding logic into the HR backend
- `itww-admin/src/app/api/job-applications/route.ts`
  Alias route used by the live website path `/api/job-applications`
- `itww-admin/src/app/(main)/job-applications/`
  Admin pages for viewing website-side job applications

## Database And Data Flow

This project works with two different database domains:

### 1. HR app database

This is the main recruitment database used by the FastAPI backend in `app/`.

It stores recruitment workflow data such as:

- users
- departments
- employees
- hiring requests
- vacancies
- candidates
- applications
- candidate matches
- interviews
- workflow events

This is the source of truth for Talent Genie.

### 2. Website database

This is the separate website-side database used for:

- published website jobs
- website-side job applications
- mappings between website jobs and HR vacancies

Common website-side tables include:

- `jobs_infos`
- `job_applications`
- `website_publication`

If a candidate exists only in `job_applications`, that candidate exists only in the website system.
The candidate becomes visible in Talent Genie only after the website forwards the submission into the HR backend.

### Backend database connection model

The FastAPI backend supports two database URLs through `app/config.py`:

- `DATABASE_URL`
  Main HR app database
- `WEBSITE_DATABASE_URL`
  Optional website database connection

The actual SQLAlchemy engine setup lives in `app/db.py`:

- `engine`
  Built from `settings.database_url`
- `website_engine`
  Built from `settings.website_database_url` when configured

That means:

- normal HR routes and models use the main HR database
- website publication support can also talk to the website database when needed

### URL normalization

`app/config.py` normalizes these formats automatically:

- `postgres://...`
- `postgresql://...`
- `postgresql+psycopg://...`

All of them are normalized to `postgresql+psycopg://...` before SQLAlchemy creates the engine.

### Session usage

The main backend request session is created in `app/db.py` through:

- `get_session()`

This is the session used by FastAPI routes and backend services for the HR database.

### Automatic website jobs table bootstrap

When `WEBSITE_DATABASE_URL` is configured, the backend also runs `ensure_website_jobs_table()` from `app/db.py`.

That function ensures the website jobs table exists and has the expected structure for:

- `jobs_infos`
- `created_at`
- `updated_at`
- `published`
- related indexes used for publication workflows

## Website To HR Sync

The website and the HR app are separate systems, so website applications must be forwarded into the HR backend.

The bridge logic lives in:

- `itww-admin/src/app/api/jobs-application/route.ts`

That route:

1. receives the website application form
2. stores the submission in the website table `job_applications`
3. resolves the linked HR vacancy through `website_publication`
4. forwards the same application to the HR backend endpoint
5. returns both the legacy website id and the Talent Genie response

The forwarded HR endpoint is:

- `POST /api/applications/public-submit`

The forwarded multipart payload includes:

- `file`
- `vacancy_id`
- `candidate_email`
- `candidate_name`
- `candidate_phone`
- `address`
- `how_did_you_hear`
- `cover_letter`
- `source_label`

The HR backend intake route lives in:

- `app/routes/applications.py`

That route then:

1. stores the uploaded CV
2. creates or reuses the candidate
3. creates the application
4. runs parsing and matching logic
5. makes the candidate visible in Talent Genie

## Main Product Flows

### 1. Hiring Request To Vacancy

1. A hiring request is created
2. The request is reviewed and approved
3. A vacancy is created from that request
4. The frontend shows the vacancy detail page, job description, and related recruitment actions

### 2. Vacancy To LinkedIn

1. The frontend calls `POST /api/integrations/n8n/linkedin-preview`
2. The backend assembles a payload with title, description, skills, and apply URL
3. The backend sends that payload to the configured `n8n` LinkedIn webhook
4. `n8n` either returns preview text or publishes the post through LinkedIn

Relevant files:

- `frontend/components/recruitment/linkedin-preview-card.tsx`
- `frontend/lib/api/client.ts`
- `app/routes/integrations.py`
- `app/services/linkedin_service.py`

### 3. Public Apply And CV Intake

1. A public user opens `/apply/[id]`
2. The application form submits a PDF CV and metadata
3. The backend extracts content and stores candidate/application data
4. Matching and summary fields are generated for recruiter review

Relevant files:

- `frontend/components/recruitment/public-apply-form.tsx`
- `app/routes/applications.py`
- `app/routes/candidates.py`
- `app/services/candidate_service.py`
- `app/services/ai_service.py`

### 3b. Website Job Application To Talent Genie

1. A candidate applies through the company website
2. The website route stores the application in `job_applications`
3. The website route resolves the mapped HR vacancy through `website_publication`
4. The website route forwards the CV and applicant data to the HR backend public submit endpoint
5. The HR backend creates the candidate/application and runs parsing

Relevant files:

- `itww-admin/src/app/api/jobs-application/route.ts`
- `itww-admin/src/app/api/job-applications/route.ts`
- `app/routes/applications.py`

### 4. Pipeline And Shortlist

1. Recruiters review applications by vacancy
2. Candidates move through shortlist and stage transitions
3. HR invite emails and interview tracking are managed through backend workflows and `n8n` callbacks
4. Candidates can self-schedule HR interviews from open slots returned by the connected calendar flow

Relevant files:

- `frontend/components/recruitment/shortlisted-page-client.tsx`
- `frontend/components/recruitment/role-pipeline-view.tsx`
- `app/services/application_workflow_service.py`
- `app/services/hr_invite_service.py`

## API Surface

All backend routes are mounted under `/api`.

The main route groups are:

- `/api/users`
- `/api/departments`
- `/api/employees`
- `/api/hiring-requests`
- `/api/vacancies`
- `/api/candidates`
- `/api/applications`
- `/api/interviews`
- `/api/integrations/n8n`
- `/api/dashboard`

Interactive docs:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/redoc`

## Environment And Integrations

The backend reads environment variables from `.env` through `app/config.py`.

Important backend variables:

```env
DATABASE_URL=postgresql+psycopg://...
WEBSITE_DATABASE_URL=postgresql+psycopg://...
WEBSITE_JOBS_TABLE=jobs_infos
WEBSITE_PUBLISHER_USER_ID=1
VERTEX_PROJECT_ID=...
VERTEX_LOCATION=global
VERTEX_GENERATIVE_MODEL=gemini-3.1-flash-lite
VERTEX_GENERATIVE_MODELS=gemini-3.1-flash-lite,gemini-3.1-pro-preview
VERTEX_EMBEDDING_MODEL=gemini-embedding-001
N8N_LINKEDIN_PREVIEW_WEBHOOK_URL=https://...
N8N_WEBHOOK_SECRET=...
N8N_CALENDAR_AVAILABILITY_WEBHOOK_URL=https://...
CAL_COM_BOOKING_BASE_URL=https://your-org.cal.com/hr-intake
CAL_COM_WEBHOOK_SECRET=...
PUBLIC_APPLY_BASE_URL=http://localhost:3000/apply
PUBLIC_SCHEDULE_BASE_URL=http://localhost:3000/candidate/schedule
HR_BACKEND_API_BASE_URL=https://it-solution-code-hr-app-backend.vercel.app/api
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,...
```

Database-related variable roles:

- `DATABASE_URL`
  Main Talent Genie / HR app database
- `WEBSITE_DATABASE_URL`
  Separate website database for website jobs and website-local applications
- `WEBSITE_JOBS_TABLE`
  Table name used for website job publication support
- `WEBSITE_PUBLISHER_USER_ID`
  User id used when creating website publication records
- `HR_BACKEND_API_BASE_URL`
  Website-side forwarding target for sending public website applications into the HR backend

For Cal.com link-based booking flows, configure a hidden booking question on the event type with identifier `application_id`.
The HR invite link appends `application_id`, `name`, and `email` as query params so Cal.com can prefill the form and return the application id in the booking webhook payload.

Important frontend variable:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

## Local Development

### Backend

From the repository root:

```powershell
cd "C:\Coding Projects\IT Solution Code"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### Frontend

In a second terminal:

```powershell
cd "C:\Coding Projects\IT Solution Code\frontend"
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend docs: `http://127.0.0.1:8000/docs`

## Local Test Checklist

To verify the main app after startup:

1. Open `http://localhost:3000`
2. Go to a vacancy detail page
3. Test `Preview LinkedIn Post`
4. Test `Publish to LinkedIn`
5. Open `/apply/[id]` and verify public apply flow
6. Review candidate and shortlist pages

For a quick backend health check:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/health"
```

## n8n Notes

This project relies on `n8n` for:

- LinkedIn preview and publish flows
- HR invite email delivery and callbacks

If a LinkedIn preview or publish action fails, the first places to inspect are:

- `app/services/linkedin_service.py`
- the `n8n` workflow execution log
- the LinkedIn node and credential configuration inside `n8n`

## Frontend Documentation

See [frontend/README.md](frontend/README.md) for a frontend-specific breakdown of routes, components, and API integration patterns.

Frontend environment updated for production backend.
