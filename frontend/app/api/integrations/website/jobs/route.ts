import { NextResponse } from "next/server";
import { Pool } from "pg";

const itwwPool = new Pool({
  connectionString:
    process.env.ITWW_DATABASE_URL ||
    "postgres://8318713cb0d8fc7b492ee917ee62bcb0a2a10eda5e99794369eca1fff80b4e17:sk_SRM1POUuNC_SnPSmPgTVp@db.prisma.io:5432/postgres?sslmode=require",
});

const ishPool = new Pool({
  connectionString:
    process.env.ISH_DATABASE_URL ||
    "postgres://4f12bd4952a67d7969aebaee6864ff94ae50db4700263e3ec8edb0c50d0017c5:sk_RbH_MG5MmBB4KbcYxqdWD@db.prisma.io:5432/postgres?sslmode=require",
});

const dinelPool = new Pool({
  connectionString:
    process.env.DINEL_DATABASE_URL ||
    "postgres://f0aef56452ba5ecb7b48f454bd6fc4820851b61fc3f6d92f72eb606984e6772d:sk_cqqYXsHjVidW3kfqJSUuL@db.prisma.io:5432/postgres?sslmode=require",
});

type PortalJob = {
  id: number;
  title: string;
  status: string;
  location: string | null;
  employment_type: string | null;
  experience_level: string | null;
  department: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  portal: string;
  portal_label: string;
};

async function fetchItwwJobs(): Promise<PortalJob[]> {
  try {
    const table = process.env.WEBSITE_JOBS_TABLE || "jobs_infos";
    const result = await itwwPool.query(
      `SELECT 
         job_info_id AS id,
         title,
         CASE WHEN published = 1 THEN 'published' ELSE 'draft' END AS status,
         location,
         type AS employment_type,
         NULL AS experience_level,
         NULL AS department,
         content AS description,
         created_at,
         updated_at,
         created_at AS published_at
       FROM public."${table}"
       ORDER BY created_at DESC
       LIMIT 200`
    );
    return result.rows.map((row) => ({
      ...row,
      status: String(row.status || "published").toLowerCase(),
      portal: "itww",
      portal_label: "ITWW",
    }));
  } catch (err) {
    console.error("Failed to fetch ITWW jobs:", err);
    return [];
  }
}

async function fetchIshJobs(): Promise<PortalJob[]> {
  try {
    const result = await ishPool.query(
      `SELECT 
         job_info_id AS id,
         title,
         CASE WHEN published = 1 THEN 'published' ELSE 'draft' END AS status,
         location,
         type AS employment_type,
         NULL AS experience_level,
         NULL AS department,
         content AS description,
         created_at,
         updated_at,
         created_at AS published_at
       FROM public."jobs_infos"
       ORDER BY created_at DESC
       LIMIT 200`
    );
    return result.rows.map((row) => ({
      ...row,
      status: String(row.status || "published").toLowerCase(),
      portal: "ish",
      portal_label: "ITSH",
    }));
  } catch (err) {
    console.error("Failed to fetch ISH jobs:", err);
    return [];
  }
}

async function fetchDinelJobs(): Promise<PortalJob[]> {
  try {
    const table = process.env.DINEL_JOBS_TABLE || "jobs";
    // The Dinel 'jobs' table may have different column names than 'jobs_infos'.
    // Try the full structured columns first; if that fails, fall back to a simpler query.
    let result;
    try {
      result = await dinelPool.query(
        `SELECT id, title, status, location, employment_type, workplace_type, experience_level,
                department, description, intro_information, vacancy_information, requirements,
                offer_information, additional_information, hours_per_week,
                created_at, updated_at, published_at
         FROM public."${table}"
         ORDER BY COALESCE(published_at, created_at) DESC
         LIMIT 200`
      );
    } catch {
      try {
        result = await dinelPool.query(
          `SELECT id, title, status, location, employment_type, experience_level,
                  department, description, created_at, updated_at, published_at
           FROM public."${table}"
           ORDER BY COALESCE(published_at, created_at) DESC
           LIMIT 200`
        );
      } catch {
        // Fallback: query with only guaranteed columns
        result = await dinelPool.query(
          `SELECT id, title,
                  COALESCE(status, 'published') AS status,
                  NULL AS location, NULL AS employment_type, NULL AS experience_level,
                  NULL AS department, description,
                  created_at, updated_at,
                  NULL AS published_at
           FROM public."${table}"
           ORDER BY created_at DESC NULLS LAST
           LIMIT 200`
        );
      }
    }
    return result.rows.map((row) => ({
      ...row,
      status: String(row.status || "published").toLowerCase(),
      portal: "dinel",
      portal_label: "Staff Outsourcing",
    }));
  } catch (err) {
    console.error("Failed to fetch Dinel jobs:", err);
    return [];
  }
}

export async function GET() {
  try {
    const [itwwJobs, ishJobs, dinelJobs] = await Promise.all([
      fetchItwwJobs(),
      fetchIshJobs(),
      fetchDinelJobs(),
    ]);

    return NextResponse.json({
      itww: itwwJobs,
      ish: ishJobs,
      dinel: dinelJobs,
      total: itwwJobs.length + ishJobs.length + dinelJobs.length,
    });
  } catch (err) {
    console.error("Portal jobs fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch portal jobs", itww: [], ish: [], dinel: [], total: 0 },
      { status: 500 }
    );
  }
}
