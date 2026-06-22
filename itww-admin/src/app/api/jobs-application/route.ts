import { NextRequest, NextResponse } from "next/server";

import pool from "@/lib/db";

export const runtime = "nodejs";

class TalentGenieForwardingError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "TalentGenieForwardingError";
    this.status = status;
    this.body = body;
  }
}

function escape(str: string) {
  return str.replace(/'/g, "''");
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveTalentGenieApiBaseUrl() {
  return (
    process.env.HR_BACKEND_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "https://it-solution-code-hr-app-backend.vercel.app/api"
  ).replace(/\/$/, "");
}

async function resolveWebsiteJobForApplication(jobCategoryId: number) {
  const result = await pool.query<{
    job_info_id: number;
    hr_vacancy_id: number | null;
    job_title: string | null;
  }>(
    `
      SELECT
        ji.job_info_id,
        ji.hr_vacancy_id,
        ji.title AS job_title
      FROM jobs_infos AS ji
      WHERE ji.job_info_id = $1
      LIMIT 1
    `,
    [jobCategoryId],
  );

  return result.rows[0] ?? null;
}

async function forwardApplicationToTalentGenie(args: {
  vacancyId: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  hear: string | null;
  coverLetter: string | null;
  resume: File;
}) {
  const apiBaseUrl = resolveTalentGenieApiBaseUrl();
  const formData = new FormData();

  formData.append("file", args.resume);
  formData.append("vacancy_id", String(args.vacancyId));
  formData.append("candidate_email", args.email);
  formData.append("candidate_name", args.name);
  if (args.phone) {
    formData.append("candidate_phone", args.phone);
  }
  if (args.address) {
    formData.append("address", args.address);
    formData.append("location", args.address);
  }
  if (args.hear) {
    formData.append("how_did_you_hear", args.hear);
  }
  if (args.coverLetter) {
    formData.append("cover_letter", args.coverLetter);
  }
  formData.append("source_label", "website_job_apply");

  const response = await fetch(`${apiBaseUrl}/applications/public-submit`, {
    method: "POST",
    body: formData,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail?: unknown }).detail ?? "")
        : "";
    const errorMessage =
      detail || `Talent Genie application forwarding failed with status ${response.status}.`;
    throw new TalentGenieForwardingError(errorMessage, response.status, payload);
  }

  return payload;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const job_applications_id = searchParams.get("id");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * pageSize;
  const search = searchParams.get("search");
  const sort = searchParams.get("sort");

  try {
    if (job_applications_id) {
      const result = await pool.query(
        `SELECT * FROM job_applications WHERE job_applications_id = $1`,
        [job_applications_id],
      );
      return NextResponse.json(result.rows[0] || null, {
        status: result.rows.length ? 200 : 404,
      });
    }

    const whereClauses: string[] = [];
    if (search) {
      const keyword = escape(search.toLowerCase());
      whereClauses.push(
        `(LOWER(i.name) LIKE '%${keyword}%' OR LOWER(i.content) LIKE '%${keyword}%')`,
      );
    }

    const whereClause = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    let sortingOrder = "ORDER BY i.created_at DESC";
    if (sort === "nameDesc") sortingOrder = "ORDER BY i.name DESC";
    else if (sort === "dateAsc") sortingOrder = "ORDER BY i.created_at ASC";

    const query = `SELECT i.*
        FROM job_applications AS i
        ${whereClause}
        ${sortingOrder}
        LIMIT ${pageSize} OFFSET ${offset}
        `;

    const countQuery = `SELECT COUNT(i.job_applications_id) FROM job_applications AS i ${whereClause}`;

    const [result, countResult] = await Promise.all([
      pool.query(query),
      pool.query(countQuery),
    ]);

    const data = {
      items: result.rows,
      totalResults: parseInt(countResult.rows[0].count, 10),
      pageSize,
      currentPage: Math.floor(offset / pageSize) + 1,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / pageSize),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch job_applications" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let legacyApplicationId: number | null = null;
  const requestId = `jobapply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const formData = await req.formData();
    const name = readRequiredString(formData, "name");
    const email = readRequiredString(formData, "email");
    const jobCategoryValue = readRequiredString(formData, "job_category_id");
    const phone = readOptionalString(formData, "phone");
    const address = readOptionalString(formData, "address");
    const hear = readOptionalString(formData, "hear");
    const coverLetter =
      readOptionalString(formData, "message") ??
      readOptionalString(formData, "cover_letter");
    const resume = formData.get("resume") ?? formData.get("file");

    if (!name) {
      return NextResponse.json({ error: "Applicant name is required." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Applicant email is required." }, { status: 400 });
    }
    if (!jobCategoryValue) {
      return NextResponse.json({ error: "Job category is required." }, { status: 400 });
    }
    if (!(resume instanceof File)) {
      return NextResponse.json({ error: "Resume upload is required." }, { status: 400 });
    }

    const jobCategoryId = Number(jobCategoryValue);
    if (!Number.isFinite(jobCategoryId) || jobCategoryId <= 0) {
      return NextResponse.json({ error: "Job category is invalid." }, { status: 400 });
    }

    console.info("[jobs-application] incoming website application", {
      requestId,
      name,
      email,
      jobCategoryId,
      filename: resume.name,
      mimeType: resume.type,
      size: resume.size,
    });

    const websiteJob = await resolveWebsiteJobForApplication(jobCategoryId);
    if (!websiteJob) {
      console.warn("[jobs-application] website job not found", {
        requestId,
        jobCategoryId,
      });
      return NextResponse.json(
        {
          error: "Website job not found.",
          request_id: requestId,
        },
        { status: 404 },
      );
    }

    if (!websiteJob.hr_vacancy_id) {
      console.warn("[jobs-application] website job missing hr_vacancy_id", {
        requestId,
        jobCategoryId,
        jobTitle: websiteJob.job_title,
      });
      return NextResponse.json(
        {
          error:
            "This website job is not linked to an HR vacancy yet. Publish or map the vacancy first.",
          request_id: requestId,
        },
        { status: 409 },
      );
    }

    const resumeBuffer = Buffer.from(await resume.arrayBuffer());
    const insertResult = await pool.query<{ job_applications_id: number }>(
      `
        INSERT INTO job_applications (
          name,
          email,
          phone,
          address,
          hear,
          message,
          job_category_id,
          resume_data,
          resume_mime,
          resume_filename,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING job_applications_id
      `,
      [
        name,
        email,
        phone,
        address,
        hear,
        coverLetter,
        String(jobCategoryId),
        resumeBuffer,
        resume.type || "application/octet-stream",
        resume.name || "resume",
      ],
    );
    legacyApplicationId = insertResult.rows[0]?.job_applications_id ?? null;

    console.info("[jobs-application] legacy website record stored", {
      requestId,
      legacyApplicationId,
      resolvedHrVacancyId: websiteJob.hr_vacancy_id,
      websiteJobId: websiteJob.job_info_id,
    });

    const talentGenieResponse = await forwardApplicationToTalentGenie({
      vacancyId: websiteJob.hr_vacancy_id,
      name,
      email,
      phone,
      address,
      hear,
      coverLetter,
      resume,
    });

    console.info("[jobs-application] Talent Genie forwarding succeeded", {
      requestId,
      legacyApplicationId,
      resolvedHrVacancyId: websiteJob.hr_vacancy_id,
      websiteJobId: websiteJob.job_info_id,
      talentGenieResponse,
    });

    return NextResponse.json(
      {
        message: "Application submitted successfully.",
        request_id: requestId,
        legacy_job_application_id: legacyApplicationId,
        vacancy_id: websiteJob.hr_vacancy_id,
        talent_genie: talentGenieResponse,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof TalentGenieForwardingError) {
      console.error("[jobs-application] HR backend forwarding failed", {
        requestId,
        legacyApplicationId,
        status: err.status,
        body: err.body,
      });

      return NextResponse.json(
        {
          error: "Application stored on website, but HR sync failed.",
          request_id: requestId,
          legacy_job_application_id: legacyApplicationId,
          hr_error: err.body,
        },
        { status: 502 },
      );
    }

    console.error("[jobs-application] application bridge failed", {
      requestId,
      legacyApplicationId,
      error: err instanceof Error ? err.message : err,
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to submit job application.",
        request_id: requestId,
        legacy_job_application_id: legacyApplicationId,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const job_applications_id = searchParams.get("id");

    if (!job_applications_id) {
      return NextResponse.json({ error: "job-application ID is required" }, { status: 400 });
    }

    const check = await pool.query(
      `SELECT * FROM job_applications WHERE job_applications_id = $1`,
      [job_applications_id],
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: "job-application not found" }, { status: 404 });
    }

    await pool.query(`DELETE FROM job_applications WHERE job_applications_id = $1`, [job_applications_id]);

    return NextResponse.json({ message: "job-application deleted successfully" });
  } catch (err) {
    console.error("Error deleting job-application:", err);
    return NextResponse.json(
      { error: "Failed to delete job-application" },
      { status: 500 },
    );
  }
}
