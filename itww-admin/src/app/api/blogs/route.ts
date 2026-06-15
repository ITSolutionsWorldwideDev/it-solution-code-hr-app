// src/app/api/blogs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, AuthTokenPayload } from "@/lib/auth";

import pool from "@/lib/db";

function escape(str: string) {
  return str.replace(/'/g, "''");
}

// -------------------------
// GET (list or single blog)
// -------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const blogid = searchParams.get("id");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * pageSize;
  const search = searchParams.get("search");
  const sort = searchParams.get("sort");

  try {
    if (blogid) {
      const result = await pool.query(
        `SELECT * FROM blogs WHERE blog_id = $1`,
        [blogid],
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
        FROM blogs AS i
        LEFT JOIN users AS u ON u.user_id = i.author_id
        ${whereClause}
        ${sortingOrder}
        LIMIT ${pageSize} OFFSET ${offset}
        `;

    const countQuery = `SELECT COUNT(i.blog_id) FROM blogs AS i ${whereClause}`;

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
      { error: "Failed to fetch blogs" },
      { status: 500 },
    );
  }
}

// -------------------------
// POST (create new blog)
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

    const { title, content, imageUrl, published } = await req.json();


    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const result = await pool.query(
      `INSERT INTO blogs (title, slug, content, imageUrl, published, author_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [title, slug, content, imageUrl || null, published ? 1 : 0, user.user_id],
    );

    console.log('result ==== ',result);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err:any) {
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
      { error: "Failed to create blog" },
      { status: 500 },
    );
  }
}

// -------------------------
// PUT (update existing blog)
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

    const { blog_id, title, content, imageUrl, published } = await req.json();

    const result = await pool.query(
      `UPDATE blogs
       SET title = $1, content = $2, imageUrl = $3, published = $4, updated_at = NOW()
       WHERE blog_id = $5
       RETURNING *`,
      [title, content, imageUrl || null, published ? 1 : 0, blog_id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
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
      { error: "Failed to update blog" },
      { status: 500 },
    );
  }
}

// -------------------------
// DELETE (remove a blog)
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
    const blogid = searchParams.get("id");

    if (!blogid) {
      return NextResponse.json({ error: "Blog ID is required" }, { status: 400 });
    }

    // Optional: Check ownership before deleting
    const check = await pool.query(
      `SELECT * FROM blogs WHERE blog_id = $1`,
      [blogid]
    );

    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    // const blog = check.rows[0];
    // if (blog.author_id !== user.user_id) {
    //   return NextResponse.json(
    //     { error: "You are not authorized to delete this blog" },
    //     { status: 403 }
    //   );
    // }

    await pool.query(`DELETE FROM blogs WHERE blog_id = $1`, [blogid]);

    return NextResponse.json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error("Error deleting blog:", err);
    return NextResponse.json(
      { error: "Failed to delete blog" },
      { status: 500 }
    );
  }
}

