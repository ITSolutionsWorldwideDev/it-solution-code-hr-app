// src/app/api/jobs-info/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, AuthTokenPayload } from "@/lib/auth";

import pool from "@/lib/db";

function escape(str: string) {
  return str.replace(/'/g, "''");
}

// -------------------------
// GET (list or single jobs-info)
// -------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const job_info_id = searchParams.get("id");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * pageSize;
  const search = searchParams.get("search");
  const sort = searchParams.get("sort");

  try {
    if (job_info_id) {
      const result = await pool.query(
        `SELECT * FROM jobs_infos WHERE job_info_id = $1`,
        [job_info_id],
      );
      return NextResponse.json(result.rows[0] || null, {
        status: result.rows.length ? 200 : 404,
      });
    }

    const whereClauses: string[] = [];
    if (search) {
      const keyword = escape(search.toLowerCase());
      whereClauses.push(
        `(LOWER(i.title) LIKE '%${keyword}%' OR LOWER(i.content) LIKE '%${keyword}%')`,
      );
    }

    const whereClause = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    let sortingOrder = "ORDER BY i.created_at DESC";
    if (sort === "nameDesc") sortingOrder = "ORDER BY i.title DESC";
    else if (sort === "dateAsc") sortingOrder = "ORDER BY i.created_at ASC";

    const query = `
        SELECT 
            i.*, 
            u.username AS author_username, 
            u.email AS author_email 
        FROM jobs_infos AS i
        LEFT JOIN users AS u ON u.user_id = i.created_by
        ${whereClause}
        ${sortingOrder}
        LIMIT ${pageSize} OFFSET ${offset}
        `;

    const countQuery = `SELECT COUNT(i.job_info_id) FROM jobs_infos AS i ${whereClause}`;

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
      { error: "Failed to fetch jobs_infos" },
      { status: 500 },
    );
  }
}

// -------------------------
// POST (create new jobs-info)
// -------------------------
export async function POST(req: NextRequest) {
  try {
    const token =
      req.cookies.get("token")?.value ||
      req.headers.get("authorization")?.replace("Bearer ", "");
    const user = verifyJWT(token || "") as AuthTokenPayload | null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, location, type, pdf_url, published } = await req.json();
    // const slug = title
    //   .toLowerCase()
    //   .replace(/[^a-z0-9]+/g, "-")
    //   .replace(/(^-|-$)+/g, "");

    const result = await pool.query(
      `INSERT INTO jobs_infos (title, location, type, pdf_url, created_at, updated_at, published, created_by)
       VALUES ($1, $2, $3, $4, NOW(), NOW(),$5, $6)
       RETURNING *`,
      [title, location, type, pdf_url || null, published ? 1 : 0, user.user_id],
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: any) {
    console.error(err);

    if (err.code === "23505") {
      return NextResponse.json(
        {
          error: "A blog with this slug already exists. Try changing the title.",
          field: "slug",  // optional: frontend can highlight field
          detail: err.detail,
        },
        { status: 409 } // 409 Conflict
      );
    }
    return NextResponse.json(
      { error: "Failed to create jobs-info" },
      { status: 500 },
    );
  }
}

// -------------------------
// PUT (update existing jobs-info)
// -------------------------
export async function PUT(req: NextRequest) {
  try {
    const token =
      req.cookies.get("token")?.value ||
      req.headers.get("authorization")?.replace("Bearer ", "");
    const user = verifyJWT(token || "") as AuthTokenPayload | null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { job_info_id, title, location, type, pdf_url, published } = await req.json();

    const result = await pool.query(
      `UPDATE jobs_infos
       SET title = $1, location = $2, type = $3, pdf_url = $4, published = $5, updated_at = NOW()
       WHERE job_info_id = $6
       RETURNING *`,
      [title, location, type, pdf_url || null, published ? 1 : 0, job_info_id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "jobs-info not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);

    if (err.code === "23505") {
      return NextResponse.json(
        {
          error: "A blog with this slug already exists. Try changing the title.",
          field: "slug",  // optional: frontend can highlight field
          detail: err.detail,
        },
        { status: 409 } // 409 Conflict
      );
    }
    return NextResponse.json(
      { error: "Failed to update jobs-info" },
      { status: 500 },
    );
  }
}

// -------------------------
// DELETE (remove a jobs-info)
// -------------------------
export async function DELETE(req: NextRequest) {
  try {
    // const token =
    //   req.cookies.get("token")?.value ||
    //   req.headers.get("authorization")?.replace("Bearer ", "");
    // const user = verifyJWT(token || "") as AuthTokenPayload | null;

    // if (!user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const { searchParams } = new URL(req.url);
    const job_info_id = searchParams.get("id");

    if (!job_info_id) {
      return NextResponse.json({ error: "jobs-info ID is required" }, { status: 400 });
    }

    // Optional: Check ownership before deleting
    const check = await pool.query(
      `SELECT * FROM jobs_infos WHERE job_info_id = $1`,
      [job_info_id]
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: "jobs-info not found" }, { status: 404 });
    }

    // const jobsInfo = check.rows[0];
    // if (jobsInfo.author_id !== user.user_id) {
    //   return NextResponse.json(
    //     { error: "You are not authorized to delete this jobs-info" },
    //     { status: 403 }
    //   );
    // }

    await pool.query(`DELETE FROM jobs_infos WHERE job_info_id = $1`, [job_info_id]);

    return NextResponse.json({ message: "jobs-info deleted successfully" });
  } catch (err) {
    console.error("Error deleting jobs-info:", err);
    return NextResponse.json(
      { error: "Failed to delete jobs-info" },
      { status: 500 }
    );
  }
}

