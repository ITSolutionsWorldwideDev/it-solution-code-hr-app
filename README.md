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
- `app/routes/candidates.py`
- `app/services/candidate_service.py`
- `app/services/ai_service.py`

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
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,...
```

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
