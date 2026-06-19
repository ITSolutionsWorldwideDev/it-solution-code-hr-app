// src/app/api/auth/sign-in/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createJWT } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const result = await pool.query(
      `SELECT user_id,email, password_hash, "firstName", "lastName" FROM users WHERE email = $1`,
      [email],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const user = result.rows[0];

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const token = await createJWT(user);

    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    });

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ✅ Set cookie using App Router API
/* (await cookies()).set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? true : false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    }); */
