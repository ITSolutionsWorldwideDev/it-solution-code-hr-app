# Developer Handover

This repository should contain the source code and tracked assets a new developer needs to continue development after cloning the project.

## Included In Git

- `app/`: FastAPI backend
- `frontend/`: main Next.js recruitment workspace and public careers pages
- `itww-admin/`: secondary website/admin application
- tracked images, PDFs, fonts, and static assets used by the apps
- tracked docs, migrations, and scripts

## Intentionally Not In Git

These items must be shared privately outside Git:

- root `.env`
- `frontend/.env.local`
- `itww-admin/.env`
- Vercel environment variables
- database credentials
- UploadThing credentials
- Vertex / Gemini / Google credentials
- n8n webhook URLs and secrets
- Cal.com secrets
- any production passwords or API keys

## Generated Or Local-Only Paths

These paths are intentionally ignored:

- `.venv/`
- `node_modules/`
- `.next/`
- `.vercel/`
- `storage/resumes/`
- `storage/website-job-pdfs/`
- `resumes/`
- runtime logs

`storage/resumes/` and `storage/website-job-pdfs/` are runtime output directories. Their source code support is already in the repository.

## Local Startup

Backend:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Admin app:

```powershell
cd itww-admin
npm install
npm run dev
```

## Private Handover Checklist

Share these with IT or the next developer:

1. Backend env values
2. Frontend env values
3. Admin env values
4. Vercel project access or env export
5. Database access details
6. Third-party service ownership details

## Branch Note

Tell the next developer which branch is the active source of truth before handover is considered complete.
