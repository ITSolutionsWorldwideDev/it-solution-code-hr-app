# Developer Handover

This document is based on the code currently in the repository, not just on the high-level README.

## Source Of Truth

The active product is primarily:

- `app/`: FastAPI backend
- `frontend/`: Next.js recruitment workspace and public careers frontend

These two folders are the main system and should be treated as the default place to continue development.

Secondary code:

- `itww-admin/`: separate website/admin application with its own auth and database access style

Removed/retired:

- `design-sandbox/` was intentionally removed from the repository and is not part of the active product anymore

## What The System Actually Does

The live recruitment flow in code is:

1. Internal user logs into the `frontend` app.
2. HR creates a hiring request.
3. Backend can generate a JD draft using Gemini / Vertex-backed services.
4. Approving a hiring request creates a `Vacancy`.
5. A vacancy can be published to the website database and mapped through `WebsitePublication`.
6. Public jobs are shown through backend endpoints under `/api/website/jobs`.
7. Candidate applies through the public frontend.
8. Backend stores the file, creates or reuses candidate/application records, creates a `ParseJob`, parses the CV, and computes match state.
9. Recruiters rank, shortlist, invite, schedule, and move the candidate through HR, technical, management, and offer stages.

## Main Runtime Entry Points

Backend:

- `app/main.py`
- `app/routes/__init__.py`
- mounted API prefix: `/api`
- static mounted PDF assets: `/website-assets/job-pdfs`

Frontend:

- `frontend/app/layout.tsx`
- `frontend/app/page.tsx`
- `frontend/lib/api/client.ts`
- `frontend/next.config.ts`

Admin app:

- `itww-admin/src/app/layout.tsx`
- `itww-admin/src/app/api/*`
- `itww-admin/src/lib/db.ts`
- `itww-admin/src/lib/auth.ts`

## Backend Truths

### API groups

The FastAPI app currently exposes these route groups:

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
- `/api/integrations/website`
- `/api/website/jobs`
- `/api/webhooks`
- `/api/dashboard`

### Database bootstrapping behavior

`app/db.py` does more than just open a connection:

- creates SQLModel tables
- ensures website `jobs_infos` table exists when website DB is configured
- ensures candidate resume storage columns exist
- ensures user auth columns exist
- creates default departments
- backfills vacancy apply URLs into descriptions

This means startup can change schema/state in development.

### Vacancy publish model

Important distinction in code:

- vacancy status is internal: `open`, `closed`, `on_hold`
- website publish state is separate and stored in `WebsitePublication`

A vacancy being `open` does not mean it is published.

Website publish is implemented in:

- `app/routes/website_integrations.py`
- `app/services/website_publish_service.py`
- `app/services/website_pdf_service.py`

Publish flow:

1. generate branded PDF
2. upload PDF to UploadThing
3. write/update row in website jobs table
4. store local mapping in `WebsitePublication`

### Public jobs source

Public job pages do not read directly from the website app.

They read from:

- `GET /api/website/jobs/`
- `GET /api/website/jobs/{vacancy_id}`

Those endpoints build the public payload from:

- `Vacancy`
- `WebsitePublication`

This means the recruitment backend remains the real source for the public jobs feed.

### Public application flow

Active public apply endpoint:

- `POST /api/applications/public-submit`

The actual implementation uses:

- `app/services/application_service.py`
- `app/services/cv_pipeline_service.py`
- `app/services/candidate_service.py`

The flow is synchronous from the app perspective:

1. store uploaded resume
2. create or reuse placeholder candidate
3. create or reuse application
4. create parse job
5. parse CV
6. update candidate and application
7. compute matching state

### CV parsing reality

There are two parsing paths in the codebase:

1. active shared pipeline in `cv_pipeline_service.py`
2. older PDF-only helper path used by legacy endpoints in `ai_service.py`

Important current behavior:

- `manual-import` and `public-submit` use the shared pipeline
- shared pipeline supports `PDF`, `DOCX`, and `DOC`
- `DOC` is stored but marked `unsupported_format`
- older `/parse-cv` style endpoints still exist and are more PDF-centric

### Matching and AI

AI and parsing are implemented through:

- `app/services/openai_service.py`
- `app/services/ai_service.py`
- `app/services/candidate_service.py`

Despite the `openai_service.py` filename, the current implementation is Gemini / Vertex oriented:

- uses `settings.gemini_api_key` when available
- otherwise uses Vertex AI if `VERTEX_PROJECT_ID` is configured

### Pipeline stages

The real application stages are defined in `app/models/enums.py`:

- `parsed`
- `ranked`
- `primary_shortlist`
- `reserve_shortlist`
- `excluded`
- `hr_invite_selected`
- `hr_invite_sent`
- `hr_interview_scheduled`
- `hr_in_progress`
- `hr_passed`
- `hr_rejected`
- `technical_interview_scheduled`
- `technical_in_progress`
- `technical_passed`
- `technical_rejected`
- `management_interview_scheduled`
- `management_in_progress`
- `selected`
- `management_rejected`
- `offer_sent`
- `offer_accepted`
- `offer_declined`
- `hired`

Role permissions for stage movement are enforced in `app/services/application_workflow_service.py`.

### Scheduling reality

Candidate self-scheduling is implemented in:

- `app/routes/applications.py`
- `app/services/calendar_availability_service.py`

Behavior:

- HR scheduling is only allowed after invite sent
- technical scheduling is only allowed once the corresponding pass/invite event exists
- management scheduling is only allowed once technical pass/invite event exists
- if calendar n8n webhooks are configured, availability and booking are delegated there
- otherwise internal slot generation is used as fallback

## Frontend Truths

### Main internal frontend

The main user-facing internal app is `frontend/`.

It is the place where users:

- log in
- manage vacancies
- upload candidates
- shortlist candidates
- move pipeline stages
- publish vacancies
- review settings

### Frontend API pattern

`frontend/lib/api/client.ts` is the central API wrapper.

Important local-dev behavior:

- if `NEXT_PUBLIC_API_BASE_URL` points to localhost, browser calls are rewritten to `/backend-api`
- `frontend/next.config.ts` rewrites `/backend-api/:path*` to `http://127.0.0.1:8000/api/:path*`

That helps when the frontend is opened via a non-localhost dev hostname.

### Public routes

The public-facing routes currently include:

- `/jobs`
- `/careers/[id]`
- `/apply/[id]`
- `/candidate/schedule/[applicationId]`

Important nuance from the code:

- `/jobs` links to `/careers/[id]`
- `/careers/[id]` and `/apply/[id]` are effectively duplicate public vacancy detail/apply pages
- LinkedIn/public URL normalization in the backend converts `/apply/...` style links toward `/careers/...`

So the safer canonical public route is:

- `/careers/[id]`

### Public jobs and fallback behavior

The public vacancy page first tries:

- `/api/website/jobs/{id}`

If that is not found, it falls back to:

- `/api/vacancies/{id}`

This means unpublished or unmapped vacancies can still render in some cases by direct ID, even though the intended public path is through published jobs.

## Website / External Integrations

### Website database integration

Website publishing assumes a website database with at least:

- `jobs_infos`
- `job_applications`

The recruitment app expects `jobs_infos` rows to be linkable back through:

- `job_info_id`
- `hr_vacancy_id`

Website application sync is implemented in:

- `app/services/website_application_sync_service.py`

That service imports legacy website applications into the recruitment app if:

- the website job row has `hr_vacancy_id`
- candidate identity exists
- resume blob exists
- the application has not already been synced

### UploadThing

UploadThing is used for website PDF upload in:

- `app/services/uploadthing_service.py`

It supports configuration through either:

- `UPLOADTHING_SECRET`
- or `UPLOADTHING_TOKEN`

### LinkedIn preview / publish

LinkedIn preview generation is handled through:

- `POST /api/integrations/n8n/linkedin-preview`
- `app/services/linkedin_service.py`

This goes to n8n and normalizes returned text and apply URLs.

### Email / invite automation

Email workflows are handled through:

- `app/services/hr_invite_service.py`

That service dispatches stage-specific email webhooks to n8n and records:

- pending events
- sent confirmations
- failures

### PDF generation

Website vacancy PDFs are generated through:

- `app/services/website_pdf_service.py`

Important implementation detail:

- it can reuse visual assets extracted from `Letter Head ITWW HD.pdf`
- it looks for branding assets in `frontend/public/` and root-level tracked files

## itww-admin Reality

`itww-admin/` is real code, but it is not the primary recruitment runtime.

What stands out from the code:

- it talks directly to PostgreSQL using `pg`, not through the FastAPI backend
- it has its own JWT logic in `itww-admin/src/lib/auth.ts`
- its auth route is separate from the main app auth
- it uses Prisma schema plus direct SQL routes
- the Prisma/database account currently used for this app is managed under `itww.hr@gmail.com`

It appears to be a secondary website/admin surface around website jobs, applications, media, and blogs.

Treat it as a separate app with separate assumptions, not as a module inside the main recruitment frontend.

## Tracked Assets And Files

Tracked and important:

- `frontend/public/*` images
- `itww-admin/public/*` images and uploaded website-side files
- root branding files like `Final Logo.png` and `Letter Head ITWW HD.pdf`
- `storage/test-cv-*` and template image files that are intentionally tracked

Generated and intentionally not in Git:

- `.venv/`
- `node_modules/`
- `.next/`
- `.vercel/`
- `storage/resumes/`
- `storage/website-job-pdfs/`
- `resumes/`
- runtime logs

Important note:

- local sample resumes in `resumes/` are ignored and not available to the next developer through Git
- runtime-generated stored CVs and generated PDFs are also ignored

## Example Environment Files In Repo

The repository now includes example env files here:

- `.env.example`
- `frontend/.env.local.example`
- `itww-admin/.env.example`

These are starter templates only. Real secrets are still private.

## Private Handover Required Outside Git

The next developer still needs these privately:

- root `.env`
- `frontend/.env.local`
- `itww-admin/.env`
- Vercel environment variables and project access
- recruitment database credentials
- website database credentials
- UploadThing credentials
- Vertex / Gemini / Google credentials
- n8n webhook URLs and webhook secret
- Cal.com booking and webhook configuration
- any shared internal login password values currently in use

## Best Starting Read Order

If a new developer needs to understand the active product quickly, start here:

1. `app/main.py`
2. `app/routes/__init__.py`
3. `app/routes/hiring_requests.py`
4. `app/routes/vacancies.py`
5. `app/routes/applications.py`
6. `app/routes/website_integrations.py`
7. `app/routes/website_public.py`
8. `app/services/cv_pipeline_service.py`
9. `app/services/application_workflow_service.py`
10. `app/services/website_publish_service.py`
11. `frontend/lib/api/client.ts`
12. `frontend/components/providers/role-provider.tsx`
13. `frontend/components/recruitment/public-apply-form.tsx`
14. `frontend/components/recruitment/candidate-upload-panel.tsx`
15. `frontend/components/recruitment/website-publish-card.tsx`
16. `frontend/app/jobs/page.tsx`
17. `frontend/app/careers/[id]/page.tsx`

## Practical Startup Order

For the active product:

1. configure backend env from `.env.example`
2. start backend from repo root
3. configure `frontend/.env.local`
4. start `frontend/`
5. only start `itww-admin/` if website/admin work is needed

## Final Mental Model

If the next developer remembers only a few things, these are the important ones:

- `app/` plus `frontend/` are the main product
- website publication is separate from vacancy status
- `/careers/[id]` is the safer canonical public vacancy route
- CV parsing is now primarily backend code, not an n8n queue
- `itww-admin/` is a separate secondary app, not the core runtime
