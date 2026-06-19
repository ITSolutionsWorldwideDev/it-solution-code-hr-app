// src/app/api/users/route.ts
import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";

/* export async function GET() {
  const users = await db.user.findMany();
  return NextResponse.json({ users });
}
 */