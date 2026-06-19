// apps/admin/app/api/media/route.ts

import { NextResponse, NextRequest } from "next/server";
import pool from "@/lib/db";

// --------------------------
// GET - List Media (NO AUTH)
// --------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const limit = Math.max(
    1,
    Math.min(100, parseInt(searchParams.get("limit") || "12", 10)),
  );

  const search = searchParams.get("search")?.trim() || "";
  const offset = (page - 1) * limit;

  try {
    const countResult = await pool.query(
      `
      SELECT COUNT(*)
      FROM media
      WHERE ($1 = '' OR file_name ILIKE $2)
      `,
      [search, `%${search}%`],
    );

    const totalRecords = parseInt(countResult.rows[0]?.count || "0", 10);

    const totalPages = Math.ceil(totalRecords / limit);

    const dataResult = await pool.query(
      `
  SELECT
    media_id,
    file_name,
    file_path AS file_path,
    file_type,
    created_at
  FROM media
  WHERE ($1 = '' OR file_name ILIKE $2)
  ORDER BY created_at DESC
  LIMIT $3 OFFSET $4
  `,
      [search, `%${search}%`, limit, offset],
    );

    return NextResponse.json({
      media: dataResult.rows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("MEDIA FETCH ERROR:", err);

    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 },
    );
  }
}

// --------------------------
// DELETE - Delete Media (NO AUTH)
// --------------------------

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  }

  try {
    await pool.query(`DELETE FROM media WHERE media_id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("MEDIA DELETE ERROR:", err);

    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 },
    );
  }
}
