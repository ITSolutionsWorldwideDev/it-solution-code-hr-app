// src/app/api/jobs-application/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, AuthTokenPayload } from "@/lib/auth";

import pool from "@/lib/db";

function escape(str: string) {
  return str.replace(/'/g, "''");
}

// -------------------------
// GET (list or single jobs-application)
// -------------------------
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

  //   SELECT job_applications_id, name, email, phone, address, hear, message, created_at, updated_at, published_at, created_by_id, updated_by_id, job_category_id
	// FROM public.job_applications;

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

// -------------------------
// DELETE (remove a jobs-application)
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
    const job_applications_id = searchParams.get("id");

    if (!job_applications_id) {
      return NextResponse.json({ error: "job-application ID is required" }, { status: 400 });
    }

    // Optional: Check ownership before deleting
    const check = await pool.query(
      `SELECT * FROM job_applications WHERE job_applications_id = $1`,
      [job_applications_id]
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
      { status: 500 }
    );
  }
}

