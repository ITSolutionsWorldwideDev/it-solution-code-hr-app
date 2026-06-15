// src/app/api/jobs-application/[id]/resume/route.ts
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: any) {
  const { id } = params;

  try {
    const query = `
      SELECT resume_filename, resume_mime, resume_data
      FROM job_applications
      WHERE job_applications_id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const file = result.rows[0];
    return new NextResponse(file.resume_data, {
      headers: {
        "Content-Type": file.resume_mime,
        "Content-Disposition": `inline; filename="${file.resume_filename}"`,
      },
    });
  } catch (error) {
    console.error("Error fetching resume:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
