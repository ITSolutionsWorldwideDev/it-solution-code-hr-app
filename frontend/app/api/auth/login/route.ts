import { NextRequest, NextResponse } from "next/server";
import { getDisplayNameFromEmail, roleProfiles, type AppRole } from "@/lib/session";

interface AuthUserConfig {
  email: string;
  password: string;
  role?: AppRole;
  name?: string;
}

function parseAuthUsers(raw?: string): AuthUserConfig[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(":");
      return {
        email: parts[0]?.trim().toLowerCase(),
        password: parts[1]?.trim() || "",
        role: (parts[2]?.trim() as AppRole) || undefined,
        name: parts[3]?.trim() || undefined,
      };
    })
    .filter((u) => u.email && u.password);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const requestedRole = (body.role as AppRole) || "HR";

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const authEmailEnv = process.env.AUTH_EMAIL?.trim();
    const authPasswordEnv = process.env.AUTH_PASSWORD?.trim();
    const authUsersEnv = process.env.AUTH_USERS?.trim();

    // Check if any auth configuration exists
    const hasConfig = Boolean((authEmailEnv && authPasswordEnv) || authUsersEnv);

    if (!hasConfig) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Authentication credentials are not configured on server. Please set AUTH_EMAIL and AUTH_PASSWORD in your environment variables.",
        },
        { status: 500 }
      );
    }

    let isAuthenticated = false;
    let matchedName: string | undefined;
    let assignedRole: AppRole = requestedRole;

    // 1. Check AUTH_USERS list (supports multiple users, e.g. email:pass or email:pass:role)
    const configuredUsers = parseAuthUsers(authUsersEnv);
    const matchedUser = configuredUsers.find(
      (u) => u.email === email && u.password === password
    );

    if (matchedUser) {
      isAuthenticated = true;
      matchedName = matchedUser.name;
      if (matchedUser.role) {
        assignedRole = matchedUser.role;
      }
    }

    // 2. Check AUTH_EMAIL and AUTH_PASSWORD (supports single email or comma-separated allowed emails)
    if (!isAuthenticated && authEmailEnv && authPasswordEnv) {
      const allowedEmails = authEmailEnv
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const emailMatches = allowedEmails.includes(email);
      const passwordMatches = password === authPasswordEnv;

      if (emailMatches && passwordMatches) {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password. Please try again." },
        { status: 401 }
      );
    }

    const displayName =
      matchedName ||
      getDisplayNameFromEmail(email) ||
      roleProfiles[assignedRole]?.name ||
      "User";

    const response = NextResponse.json({
      ok: true,
      user: {
        email,
        name: displayName,
        role: assignedRole,
      },
    });

    // Set HTTP-only session cookie for safety & persistence
    response.cookies.set("talent_genie_auth", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Auth login error:", err);
    return NextResponse.json(
      { ok: false, error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
