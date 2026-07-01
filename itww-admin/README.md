# ITWW Admin

Secondary website/admin application built with Next.js, Prisma, and PostgreSQL.

## Start

```powershell
cd "C:\Coding Projects\IT Solution Code\itww-admin"
npm install
npm run dev
```

## Environment

Use `itww-admin/.env.example` as the starting point for local setup.

Typical required values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
UPLOADTHING_TOKEN=""
```

## Notes

- This app is separate from the main recruitment runtime in `app/` plus `frontend/`.
- Prisma schema lives in `itww-admin/prisma/schema.prisma`.
- The Prisma/database account currently used for this app is managed under `itww.hr@gmail.com`.
- Website-side static media and uploaded files are intentionally tracked under `public/`.
