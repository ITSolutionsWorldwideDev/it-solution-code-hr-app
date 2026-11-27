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

function formatDinelLines(items: unknown): string {
  if (Array.isArray(items)) {
    return items
      .map((i) => String(i).trim().replace(/^[-*•\d+.)]+\s*/, ""))
      .filter((i) => i.length > 2 && !/^\d{1,2}$/.test(i))
      .join("\n");
  }
  return String(items || "").trim();
}

function extractStructuredSectionsFromRaw(rawText: string) {
  const lines = rawText.split("\n");
  let currentSection = "about";
  const aboutLines: string[] = [];
  const resps: string[] = [];
  const reqs: string[] = [];
  const offers: string[] = [];
  const extras: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cleanHeading = trimmed.replace(/^[#*_\s]+|[#*_\s:]+$/g, "").toLowerCase();

    if (
      cleanHeading === "about the role" ||
      cleanHeading === "position overview" ||
      cleanHeading === "about us" ||
      cleanHeading.startsWith("about it solutions") ||
      cleanHeading === "functieoverzicht" ||
      cleanHeading === "role overview"
    ) {
      currentSection = "about";
      continue;
    } else if (
      cleanHeading === "what you'll do" ||
      cleanHeading === "what you’ll do" ||
      cleanHeading === "key responsibilities" ||
      cleanHeading === "responsibilities" ||
      cleanHeading === "core responsibilities" ||
      cleanHeading === "taken" ||
      cleanHeading === "taken & verantwoordelijkheden"
    ) {
      currentSection = "resp";
      continue;
    } else if (
      cleanHeading === "what you'll bring" ||
      cleanHeading === "what you’ll bring" ||
      cleanHeading === "requirements" ||
      cleanHeading === "skills & requirements" ||
      cleanHeading === "skills" ||
      cleanHeading === "qualifications" ||
      cleanHeading === "vereisten" ||
      cleanHeading === "wat wij zoeken" ||
      cleanHeading === "wat wij vragen" ||
      cleanHeading === "tools & platforms (preferred)"
    ) {
      currentSection = "req";
      continue;
    } else if (
      cleanHeading === "what we offer" ||
      cleanHeading === "nice to have" ||
      cleanHeading === "wat wij bieden" ||
      cleanHeading === "aanbod" ||
      cleanHeading === "perks" ||
      cleanHeading === "benefits"
    ) {
      currentSection = "offer";
      continue;
    } else if (
      cleanHeading === "additional information" ||
      cleanHeading === "additional info" ||
      cleanHeading === "aanvullende informatie" ||
      cleanHeading === "trainings- en ontwikkelprogramma"
    ) {
      currentSection = "extra";
      continue;
    }

    if (/^\d{1,2}$/.test(trimmed)) continue;
    const bullet = trimmed.replace(/^[-*•\d+.)]+\s*/, "").trim();
    if (!bullet) continue;

    if (currentSection === "about") {
      if (trimmed.length > 20) aboutLines.push(trimmed);
    } else if (currentSection === "resp") {
      resps.push(bullet);
    } else if (currentSection === "req") {
      reqs.push(bullet);
    } else if (currentSection === "offer") {
      offers.push(bullet);
    } else if (currentSection === "extra") {
      extras.push(bullet);
    }
  }

  return {
    aboutRole: aboutLines,
    responsibilities: resps,
    requirements: reqs,
    offers,
    extras,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      portal,
      id,
      title,
      location,
      employment_type,
      status,
      department,
      description,
    } = body;

    if (!portal || !id) {
      return NextResponse.json(
        { error: "Both 'portal' and 'id' are required to update a job." },
        { status: 400 }
      );
    }

    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) {
      return NextResponse.json(
        { error: "Job title cannot be empty." },
        { status: 400 }
      );
    }

    const numericId = Number(id);
    const loc = location ? String(location).trim() : null;
    const empType = employment_type ? String(employment_type).trim() : "Full-time";
    const desc = description !== undefined ? String(description).trim() : null;
    const isPublished =
      status?.toLowerCase() === "draft" ? 0 : status?.toLowerCase() === "closed" ? 0 : 1;

    // 1. ITWW Portal Update
    if (portal === "itww") {
      const table = process.env.WEBSITE_JOBS_TABLE || "jobs_infos";
      let query = `
        UPDATE public."${table}"
        SET title = $1,
            location = $2,
            type = $3,
            published = $4,
            updated_at = NOW()
      `;
      const params: any[] = [trimmedTitle, loc, empType, isPublished];

      if (desc !== null) {
        query += `, content = $5 WHERE job_info_id = $6 RETURNING job_info_id AS id, title, location, type AS employment_type, CASE WHEN published = 1 THEN 'published' ELSE 'draft' END AS status, content AS description, updated_at`;
        params.push(desc, numericId);
      } else {
        query += ` WHERE job_info_id = $5 RETURNING job_info_id AS id, title, location, type AS employment_type, CASE WHEN published = 1 THEN 'published' ELSE 'draft' END AS status, content AS description, updated_at`;
        params.push(numericId);
      }

      const res = await itwwPool.query(query, params);
      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: `Job #${numericId} not found on ITWW portal.` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        portal: "itww",
        portal_label: "ITWW",
        job: { ...res.rows[0], portal: "itww", portal_label: "ITWW" },
        message: `Job #${numericId} successfully updated on ITWW.`,
      });
    }

    // 2. ISH Portal Update
    if (portal === "ish") {
      let query = `
        UPDATE public."jobs_infos"
        SET title = $1,
            location = $2,
            type = $3,
            published = $4,
            updated_at = NOW()
      `;
      const params: any[] = [trimmedTitle, loc, empType, isPublished];

      if (desc !== null) {
        query += `, content = $5 WHERE job_info_id = $6 RETURNING job_info_id AS id, title, location, type AS employment_type, CASE WHEN published = 1 THEN 'published' ELSE 'draft' END AS status, content AS description, updated_at`;
        params.push(desc, numericId);
      } else {
        query += ` WHERE job_info_id = $5 RETURNING job_info_id AS id, title, location, type AS employment_type, CASE WHEN published = 1 THEN 'published' ELSE 'draft' END AS status, content AS description, updated_at`;
        params.push(numericId);
      }

      const res = await ishPool.query(query, params);
      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: `Job #${numericId} not found on ISH portal.` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        portal: "ish",
        portal_label: "ITSH",
        job: { ...res.rows[0], portal: "ish", portal_label: "ITSH" },
        message: `Job #${numericId} successfully updated on ITSH.`,
      });
    }

    // 3. Dinel (Staff Outsourcing) Update
    if (portal === "dinel") {
      const table = process.env.DINEL_JOBS_TABLE || "jobs";
      const slug = slugify(trimmedTitle);

      let dinelEmpType = "FULL_TIME";
      const rawEmp = empType.toLowerCase();
      if (rawEmp.includes("part")) dinelEmpType = "PART_TIME";
      else if (rawEmp.includes("contract") || rawEmp.includes("freelance")) dinelEmpType = "CONTRACT";
      else if (rawEmp.includes("intern")) dinelEmpType = "INTERN";

      let dinelStatus = "PUBLISHED";
      const rawStat = String(status || "").toLowerCase();
      if (rawStat.includes("draft")) dinelStatus = "DRAFT";
      else if (rawStat.includes("closed") || rawStat.includes("archive")) dinelStatus = "ARCHIVED";

      // Parse structured sections if description is provided
      const parsedSections = desc ? extractStructuredSectionsFromRaw(desc) : null;
      const introText =
        parsedSections && parsedSections.aboutRole.length > 0
          ? parsedSections.aboutRole.join("\n\n")
          : desc || `${trimmedTitle} position overview.`;
      const respText =
        parsedSections && parsedSections.responsibilities.length > 0
          ? formatDinelLines(parsedSections.responsibilities)
          : null;
      const reqText =
        parsedSections && parsedSections.requirements.length > 0
          ? formatDinelLines(parsedSections.requirements)
          : null;
      const offerText =
        parsedSections && parsedSections.offers.length > 0
          ? formatDinelLines(parsedSections.offers)
          : null;
      const addText =
        parsedSections && parsedSections.extras.length > 0
          ? formatDinelLines(parsedSections.extras)
          : null;

      let res;
      try {
        res = await dinelPool.query(
          `UPDATE public."${table}"
           SET title = $1,
               slug = $2,
               location = $3,
               employment_type = $4::employment_type,
               status = $5::job_status,
               visibility = 'PUBLIC',
               description = COALESCE($6, description),
               intro_information = COALESCE($7, intro_information),
               vacancy_information = COALESCE($8, vacancy_information),
               requirements = COALESCE($9, requirements),
               offer_information = COALESCE($10, offer_information),
               additional_information = COALESCE($11, additional_information),
               department = COALESCE($12, department),
               published_at = CASE WHEN $5::job_status = 'PUBLISHED' THEN NOW() ELSE published_at END,
               updated_at = NOW()
           WHERE id = $13
           RETURNING id, title, slug, location, employment_type, status, department, description, updated_at`,
          [
            trimmedTitle,
            slug,
            loc,
            dinelEmpType,
            dinelStatus,
            desc,
            introText,
            respText,
            reqText,
            offerText,
            addText,
            department || null,
            numericId,
          ]
        );
      } catch {
        // Fallback without enum casts if types are plain text in database
        res = await dinelPool.query(
          `UPDATE public."${table}"
           SET title = $1,
               slug = $2,
               location = $3,
               description = COALESCE($4, description),
               intro_information = COALESCE($5, intro_information),
               vacancy_information = COALESCE($6, vacancy_information),
               requirements = COALESCE($7, requirements),
               updated_at = NOW()
           WHERE id = $8
           RETURNING id, title, location, status, description, updated_at`,
          [trimmedTitle, slug, loc, desc, introText, respText, reqText, numericId]
        );
      }

      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: `Job #${numericId} not found on Staff Outsourcing portal.` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        portal: "dinel",
        portal_label: "Staff Outsourcing",
        job: { ...res.rows[0], portal: "dinel", portal_label: "Staff Outsourcing" },
        message: `Job #${numericId} successfully updated on Staff Outsourcing.`,
      });
    }

    return NextResponse.json(
      { error: `Unknown portal '${portal}'. Supported portals: itww, ish, dinel.` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Failed to update portal job:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update portal job in database." },
      { status: 500 }
    );
  }
}
