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

function formatBullets(items: unknown): string {
  if (Array.isArray(items)) {
    return items
      .map((i) => `• ${String(i).trim().replace(/^[-*•\d+.)]+\s*/, "")}`)
      .join("\n");
  }
  return String(items || "").trim();
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

function formatNumberedSteps(items: unknown): string {
  if (Array.isArray(items)) {
    return items
      .filter((i) => String(i).trim().length > 2 && !/^\d{1,2}$/.test(String(i).trim()))
      .map((item, idx) => {
        const str = String(item).trim();
        if (/^\d{2}\s/.test(str)) return str;
        const num = String(idx + 1).padStart(2, "0");
        return `${num} ${str.replace(/^[-*•\d+.)]+\s*/, "")}`;
      })
      .join("\n\n");
  }
  return String(items || "").trim();
}

function cleanRoleOverview(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false;
      const lower = p.toLowerCase();
      if (
        lower.includes("| it solutions") ||
        lower.startsWith("location") ||
        lower.startsWith("work type") ||
        lower.startsWith("job type") ||
        lower.startsWith("salary indication") ||
        lower.startsWith("experience") ||
        lower.startsWith("start date") ||
        lower.startsWith("[plak hier") ||
        lower.startsWith("apply for")
      ) {
        return false;
      }
      return p.length > 30;
    });

  return paragraphs.join("\n\n");
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
    } else if (
      cleanHeading === "apply here" ||
      cleanHeading.startsWith("apply for") ||
      cleanHeading === "solliciteren" ||
      cleanHeading.startsWith("plak hier") ||
      cleanHeading === "why it solutions worldwide" ||
      cleanHeading === "excellence in execution. consistency in results."
    ) {
      currentSection = "ignore";
      continue;
    }

    if (currentSection === "ignore") continue;

    const lower = trimmed.toLowerCase();
    if (
      currentSection === "about" &&
      (lower.startsWith("location") ||
        lower.startsWith("job type") ||
        lower.startsWith("salary indication") ||
        lower.startsWith("experience") ||
        lower.startsWith("start date") ||
        lower.startsWith("work type") ||
        lower.includes("| it solutions"))
    ) {
      continue;
    }

    if (/^\d{1,2}$/.test(trimmed)) continue;

    const bullet = trimmed.replace(/^[-*•\d+.)]+\s*/, "").trim();
    if (!bullet) continue;

    if (currentSection === "about") {
      if (trimmed.length > 25) aboutLines.push(trimmed);
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
    about: aboutLines.join("\n\n"),
    responsibilities: resps,
    requirements: reqs,
    offers: offers,
    additionalInfo: extras.join("\n"),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      vacancy_id,
      target_portal,
      portals: customPortals,
      title = "Untitled Vacancy",
      about_role: rawAbout = "",
      responsibilities: rawResp = [],
      requirements: rawReq = [],
      nice_to_have: rawOffer = [],
      additional_info: rawAdd = "",
      location = "Amsterdam, Netherlands",
      employment_type = "Full-time",
      work_model = "Hybrid",
      description = "",
    } = body;

    // Resolve target portals strictly
    let resolvedPortals: string[] = [];
    if (Array.isArray(customPortals) && customPortals.length > 0) {
      resolvedPortals = customPortals;
    } else {
      const pStr = String(target_portal || "all").toLowerCase();
      if (pStr === "all" || pStr === "all_portals") {
        resolvedPortals = ["itww", "ish", "dinel"];
      } else if (pStr === "both") {
        resolvedPortals = ["itww", "ish"];
      } else {
        const parts = pStr.split(/[,\s;&]+/);
        for (const p of parts) {
          if (p === "itww" || p === "worldwide") resolvedPortals.push("itww");
          else if (p === "ish" || p === "hub") resolvedPortals.push("ish");
          else if (p === "dinel" || p === "staff_outsourcing" || p === "staffoutsourcing")
            resolvedPortals.push("dinel");
        }
      }
    }

    if (resolvedPortals.length === 0) {
      resolvedPortals = ["itww", "ish", "dinel"];
    }

    // Auto-parse full raw content if incoming lists are fallback/empty
    const isFallbackResp =
      !rawResp ||
      rawResp.length === 0 ||
      (rawResp.length === 1 && String(rawResp[0]).includes("Deliver core responsibilities"));
    const isFallbackReq =
      !rawReq ||
      rawReq.length === 0 ||
      (rawReq.length === 1 && String(rawReq[0]).includes("Relevant experience"));

    let responsibilities = rawResp;
    let requirements = rawReq;
    let nice_to_have = rawOffer;
    let additional_info = rawAdd;
    let about_role = rawAbout;

    if (isFallbackResp || isFallbackReq) {
      const fallbackSource = description || rawAbout || "";
      if (fallbackSource.length > 100) {
        const extracted = extractStructuredSectionsFromRaw(fallbackSource);
        if (extracted.responsibilities.length > 0) {
          responsibilities = extracted.responsibilities;
        }
        if (extracted.requirements.length > 0) {
          requirements = extracted.requirements;
        }
        if (extracted.offers.length > 0) {
          nice_to_have = extracted.offers;
        }
        if (extracted.about.length > 50) {
          about_role = extracted.about;
        }
        if (extracted.additionalInfo) {
          additional_info = extracted.additionalInfo;
        }
      }
    }

    // Clean Role Overview of any leftover metadata headers
    const cleanedAboutRole = cleanRoleOverview(about_role) || about_role;

    const actionsTaken: string[] = [];
    let itwwId: number | null = null;
    let ishId: number | null = null;
    let dinelId: number | null = null;

    const slug = slugify(title);

    // 1. Publish to ITWW (Only if "itww" explicitly selected!)
    if (resolvedPortals.includes("itww")) {
      const itwwMarkdown = [
        `## About the Role\n\n${cleanedAboutRole || "Role overview and operating environment."}`,
        `## What You'll Do\n\n${formatNumberedSteps(responsibilities)}`,
        `## What You'll Bring\n\n${formatBullets(requirements)}`,
        `## Nice to Have\n\n${formatBullets(nice_to_have)}`,
        additional_info ? `## Additional Information\n\n${additional_info}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const existing = await itwwPool.query(
        "SELECT job_info_id FROM jobs_infos WHERE LOWER(TRIM(title)) = LOWER(TRIM($1)) ORDER BY job_info_id DESC LIMIT 1",
        [title]
      );

      if (existing.rows.length > 0) {
        itwwId = existing.rows[0].job_info_id;
        await itwwPool.query(
          "UPDATE jobs_infos SET content = $1, location = $2, type = $3, published = 1, updated_at = NOW() WHERE job_info_id = $4",
          [itwwMarkdown, location, employment_type, itwwId]
        );
        actionsTaken.push(`ITWW (#${itwwId})`);
      } else {
        const ins = await itwwPool.query(
          "INSERT INTO jobs_infos (title, location, type, content, published, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, 1, 1, NOW(), NOW()) RETURNING job_info_id",
          [title, location, employment_type, itwwMarkdown]
        );
        itwwId = ins.rows[0].job_info_id;
        actionsTaken.push(`ITWW (#${itwwId})`);
      }
    }

    // 2. Publish to ISH (Only if "ish" explicitly selected!)
    if (resolvedPortals.includes("ish")) {
      const ishMarkdown = [
        `## About the Role\n\n${cleanedAboutRole || "Role overview and operating environment."}`,
        `## What You'll Do\n\n${formatNumberedSteps(responsibilities)}`,
        `## What You'll Bring\n\n${formatBullets(requirements)}`,
        `## Nice to Have\n\n${formatBullets(nice_to_have)}`,
        additional_info ? `## Additional Information\n\n${additional_info}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const existingIsh = await ishPool.query(
        "SELECT job_info_id FROM jobs_infos WHERE LOWER(TRIM(title)) = LOWER(TRIM($1)) ORDER BY job_info_id DESC LIMIT 1",
        [title]
      );

      if (existingIsh.rows.length > 0) {
        ishId = existingIsh.rows[0].job_info_id;
        await ishPool.query(
          "UPDATE jobs_infos SET content = $1, location = $2, type = $3, published = 1, updated_at = NOW() WHERE job_info_id = $4",
          [ishMarkdown, location, employment_type, ishId]
        );
        actionsTaken.push(`ISH (#${ishId})`);
      } else {
        const insIsh = await ishPool.query(
          "INSERT INTO jobs_infos (title, location, type, content, published, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, 1, 1, NOW(), NOW()) RETURNING job_info_id",
          [title, location, employment_type, ishMarkdown]
        );
        ishId = insIsh.rows[0].job_info_id;
        actionsTaken.push(`ISH (#${ishId})`);
      }
    }

    // 3. Publish to Dinel (Staff Outsourcing) (Only if "dinel" explicitly selected!)
    // Formatted exactly like dinel-admin.vercel.app/jobs/create expects!
    if (resolvedPortals.includes("dinel")) {
      const introText = cleanedAboutRole || `${title} position overview.`;
      const respText = formatDinelLines(responsibilities);
      const reqText = formatDinelLines(requirements);
      const offerText = formatDinelLines(nice_to_have);
      const addText = additional_info ? String(additional_info).trim() : null;

      const existingDinel = await dinelPool.query(
        "SELECT id FROM jobs WHERE slug = $1 OR LOWER(TRIM(title)) = LOWER(TRIM($2)) ORDER BY id DESC LIMIT 1",
        [slug, title]
      );

      let empType = "FULL_TIME";
      const rawEmp = String(employment_type).toLowerCase();
      if (rawEmp.includes("part")) empType = "PART_TIME";
      else if (rawEmp.includes("contract") || rawEmp.includes("freelance")) empType = "CONTRACT";
      else if (rawEmp.includes("intern")) empType = "INTERN";

      let workType = "HYBRID";
      const rawWork = String(work_model).toLowerCase();
      if (rawWork.includes("remote")) workType = "REMOTE";
      else if (rawWork.includes("onsite") || rawWork.includes("on-site")) workType = "ONSITE";

      if (existingDinel.rows.length > 0) {
        dinelId = existingDinel.rows[0].id;
        await dinelPool.query(
          `UPDATE jobs
           SET title = $1,
               description = $2,
               location = $3,
               employment_type = $4::employment_type,
               workplace_type = $5::workplace_type,
               experience_level = 'MID'::experience_level,
               status = 'PUBLISHED'::job_status,
               visibility = 'PUBLIC',
               intro_information = $2,
               vacancy_information = $6,
               requirements = $7,
               offer_information = $8,
               additional_information = $9,
               company_information = 'Staff Outsourcing & IT Solutions Worldwide',
               hours_per_week = 40,
               published_at = NOW(),
               updated_at = NOW()
           WHERE id = $10`,
          [title, introText, location, empType, workType, respText, reqText, offerText, addText, dinelId]
        );
        actionsTaken.push(`Staff Outsourcing (#${dinelId})`);
      } else {
        const insDinel = await dinelPool.query(
          `INSERT INTO jobs (
             title, slug, description, location, employment_type, workplace_type, experience_level,
             status, visibility, intro_information, vacancy_information, requirements, offer_information,
             additional_information, company_information, hours_per_week, company_id, created_by,
             published_at, created_at, updated_at
           )
           VALUES (
             $1, $2, $3, $4, $5::employment_type, $6::workplace_type, 'MID'::experience_level,
             'PUBLISHED'::job_status, 'PUBLIC', $3, $7, $8, $9,
             $10, 'Staff Outsourcing & IT Solutions Worldwide', 40, 1, 1,
             NOW(), NOW(), NOW()
           )
           RETURNING id`,
          [title, slug, introText, location, empType, workType, respText, reqText, offerText, addText]
        );
        dinelId = insDinel.rows[0].id;
        actionsTaken.push(`Staff Outsourcing (#${dinelId})`);
      }
    }

    const portalNamesMap: Record<string, string> = {
      itww: "IT Solutions Worldwide",
      ish: "IT Solutions Hub",
      dinel: "Staff Outsourcing",
    };
    const targetLabel = resolvedPortals.map((p) => portalNamesMap[p] || p).join(" & ");

    return NextResponse.json({
      success: true,
      dry_run: false,
      message: `Vacancy published to ${targetLabel}: ${actionsTaken.join(", ")}.`,
      published: true,
      action: "published",
      job_info_id: itwwId || ishId || dinelId || vacancy_id,
      itww_job_info_id: itwwId,
      ish_job_info_id: ishId,
      dinel_job_info_id: dinelId,
      target_portal: resolvedPortals.join(","),
      mapped_fields: {
        title,
        location,
        type: employment_type,
        published: 1,
      },
    });
  } catch (error) {
    console.error("Portal publish error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to publish to portals.",
      },
      { status: 500 }
    );
  }
}
