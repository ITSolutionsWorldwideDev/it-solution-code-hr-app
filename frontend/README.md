# AI Recruitment Frontend

This frontend is the operator UI for the recruitment platform. It is built for HR, hiring managers, and internal reviewers who need to create vacancies, review candidates, and manage the hiring pipeline.

## Stack

- `Next.js 15` with App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS`

## What The Frontend Covers

The frontend includes screens for:

- login and landing
- role-based dashboards
- hiring requests
- vacancies
- vacancy detail and LinkedIn preview/publish
- candidate database
- shortlist review
- stage pipeline review
- public vacancy apply form
- onboarding and organogram views

## Frontend Structure

```text
frontend/
|- app/                     Route entrypoints
|- components/
|  |- auth/                 Login and landing UI
|  |- brand/                Logo and brand elements
|  |- dashboard/            Dashboard views
|  |- employees/            Organogram and onboarding UI
|  |- layout/               Shared shell, sidebar, top bar
|  |- providers/            React providers such as role context
|  |- recruitment/          Core hiring product components
|  `- ui/                   Reusable UI controls
|- lib/
|  |- api/                  API client wrapper
|  |- mock/                 Mock data used in some dashboard flows
|  `- *.ts                  Shared types, helpers, session logic
`- README.md
```

## App Router Pages

Main routes in `frontend/app/`:

- `/`
  Home entrypoint, currently routed to the login home
- `/login`
  Login page
- `/dashboard`
  Dashboard landing
- `/dashboard/admin`
- `/dashboard/hr`
- `/dashboard/technical`
  Role-specific dashboards
- `/hiring-requests`
  Hiring request workflow
- `/vacancies`
  Vacancy list
- `/vacancies/[id]`
  Vacancy detail page, recruitment actions, LinkedIn preview, and hidden-potential discovery
- `/candidates`
  Candidate database
- `/shortlisted`
  Shortlist review page
- `/pipeline`
  Pipeline overview
- `/pipeline/[id]`
  Candidate-specific pipeline detail
- `/apply/[id]`
  Public vacancy apply page
- `/departments`
- `/organogram`
- `/onboarding`
  Supporting HR/admin pages

## Component Layers

### `components/recruitment`

This is the main product area. Important files include:

- `vacancies-page-client.tsx`
  Vacancy list data loading and page behavior
- `vacancy-detail-page-client.tsx`
  Vacancy detail data loading and orchestration
- `vacancy-detail.tsx`
  Vacancy detail presentation
- `linkedin-preview-card.tsx`
  Preview and publish UI for LinkedIn through the backend + `n8n`
- `public-apply-form.tsx`
  Public candidate application form
- `candidate-database-page-client.tsx`
  Candidate database screen
- `shortlisted-page-client.tsx`
  Shortlist actions and HR invite workflows
- `role-pipeline-view.tsx`
  Pipeline transitions and stage control

### `components/layout`

Shared navigation and layout:

- `dashboard-shell.tsx`
- `sidebar.tsx`
- `top-bar.tsx`
- `dashboard-header.tsx`

### `components/ui`

Reusable design primitives such as:

- `button.tsx`
- `input.tsx`
- `select.tsx`
- `textarea.tsx`
- cards, badges, pills, panels, and list/table helpers

## Data And API Pattern

The frontend talks to the backend through:

- `lib/api/client.ts`

That file centralizes:

- `NEXT_PUBLIC_API_BASE_URL`
- request headers
- JSON parsing
- backend error extraction
- clearer network error messages

Most page-level data loading is done in client components with `useEffect` and `apiRequest(...)`.

## Important Frontend Flows

### Vacancy Detail And LinkedIn Preview

The vacancy detail page:

1. loads the vacancy from the backend
2. loads departments for display mapping
3. triggers hidden-potential discovery
4. renders the LinkedIn preview/publish card

Relevant files:

- `app/vacancies/[id]/page.tsx`
- `components/recruitment/vacancy-detail-page-client.tsx`
- `components/recruitment/linkedin-preview-card.tsx`

### Public Apply

The public apply page:

1. loads the vacancy by id
2. shows vacancy information
3. uploads a PDF CV and applicant contact info to the backend

Relevant files:

- `app/apply/[id]/page.tsx`
- `components/recruitment/public-apply-form.tsx`

### Shortlist And Pipeline

The shortlist and pipeline views let recruiters:

- review match summaries
- invite candidates
- move candidates between stages
- reject or progress applications

Relevant files:

- `components/recruitment/shortlisted-page-client.tsx`
- `components/recruitment/role-pipeline-view.tsx`
- `components/recruitment/pipeline-board.tsx`

## Local Development

### Install

```powershell
cd "C:\Coding Projects\IT Solution Code\frontend"
npm install
```

### Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

### Start

```powershell
cd "C:\Coding Projects\IT Solution Code\frontend"
npm run dev
```

Open:

```text
http://localhost:3000
```

## Working With The Backend

This frontend expects the FastAPI backend to be running at the URL in `NEXT_PUBLIC_API_BASE_URL`.

In this repository, that usually means:

```powershell
cd "C:\Coding Projects\IT Solution Code"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Testing The Main UI Flow

Once frontend and backend are running:

1. Open `http://localhost:3000`
2. Go to `/vacancies`
3. Open a vacancy detail page
4. Test `Preview LinkedIn Post`
5. Test `Publish to LinkedIn`
6. Open `/apply/[id]` to test public application flow
7. Review `/shortlisted` and `/pipeline`

## Notes

- Some older dashboard areas still reference mock data in `lib/mock/`
- Recruitment flows primarily use the real backend through `lib/api/client.ts`
- The `design-sandbox/` folder is a separate UI playground and is not the main application runtime
