// apps/admin/app/api/media/save/route.ts

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { file_name, file_path, file_type } = body;

    if (!file_path) {
      return NextResponse.json({ error: "Missing file_path" }, { status: 400 });
    }

    // 🔒 basic validation (IMPORTANT)
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg", // PDF
      "application/pdf",

      // Word (.doc)
      "application/msword",

      // Word (.docx)
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file_type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO media
        (file_name, file_path, file_type)
       VALUES ($1, $2, $3)
       RETURNING media_id`,
      [file_name, file_path, file_type],
    );

    return NextResponse.json({
      success: true,
      mediaId: result.rows[0].media_id,
    });
  } catch (err) {
    console.error("MEDIA SAVE ERROR:", err);
    return NextResponse.json(
      { error: "Failed to save media" },
      { status: 500 },
    );
  }
}
