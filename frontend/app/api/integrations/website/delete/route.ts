import { NextRequest, NextResponse } from "next/server";
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      vacancy_id,
      title = "",
      itww_job_info_id,
      ish_job_info_id,
      dinel_job_info_id,
    } = body;

    const trimmedTitle = String(title || "").trim();
    const slug = slugify(trimmedTitle);
    const deletedNotes: string[] = [];

    // 1. Delete from ITWW
    if (trimmedTitle || itww_id_valid(itww_job_info_id)) {
      try {
        const itwwId = itww_id_valid(itww_job_info_id) ? Number(itww_job_info_id) : null;
        const resItww = await itwwPool.query(
          `DELETE FROM jobs_infos
           WHERE (LOWER(TRIM(title)) = LOWER(TRIM($1)))
              OR ($2::int IS NOT NULL AND job_info_id = $2)
           RETURNING job_info_id`,
          [trimmedTitle, itwwId]
        );
        if (resItww.rows.length > 0) {
          deletedNotes.push(`ITWW (${resItww.rows.length} removed)`);
        }
      } catch (e) {
        console.warn("ITWW delete warning:", e);
      }
    }

    // 2. Delete from ISH (IT Solutions Hub)
    if (trimmedTitle || itww_id_valid(ish_job_info_id)) {
      try {
        const ishId = itww_id_valid(ish_job_info_id) ? Number(ish_job_info_id) : null;
        const resIsh = await ishPool.query(
          `DELETE FROM jobs_infos
           WHERE (LOWER(TRIM(title)) = LOWER(TRIM($1)))
              OR ($2::int IS NOT NULL AND job_info_id = $2)
           RETURNING job_info_id`,
          [trimmedTitle, ishId]
        );
        if (resIsh.rows.length > 0) {
          deletedNotes.push(`ISH (${resIsh.rows.length} removed)`);
        }
      } catch (e) {
        console.warn("ISH delete warning:", e);
      }
    }

    // 3. Delete from Dinel (Staff Outsourcing)
    if (slug || trimmedTitle || itww_id_valid(dinel_job_info_id)) {
      try {
        const dinelId = itww_id_valid(dinel_job_info_id) ? Number(dinel_job_info_id) : null;
        const resDinel = await dinelPool.query(
          `DELETE FROM jobs
           WHERE (slug = $1 AND $1 != '')
              OR (LOWER(TRIM(title)) = LOWER(TRIM($2)))
              OR ($3::int IS NOT NULL AND id = $3)
           RETURNING id`,
          [slug, trimmedTitle, dinelId]
        );
        if (resDinel.rows.length > 0) {
          deletedNotes.push(`Staff Outsourcing (${resDinel.rows.length} removed)`);
        }
      } catch (e) {
        console.warn("Dinel delete warning:", e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Vacancy removed from ${deletedNotes.length ? deletedNotes.join(", ") : "career portals"}.`,
      action: "deleted",
      published: false,
      vacancy_id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to unpublish vacancy.",
      },
      { status: 500 }
    );
  }
}

function itww_id_valid(id: unknown): boolean {
  return typeof id === "number" ? id > 0 : Boolean(id && !isNaN(Number(id)) && Number(id) > 0);
}
