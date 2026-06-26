export const appRoles = ["HR", "Technical", "Manager", "Admin"] as const;
export const prototypeRoles = ["HR", "Technical", "Manager"] as const;

export type AppRole = (typeof appRoles)[number];

export type SessionUser = {
  userId: number;
  email: string;
  name: string;
  role: AppRole;
};

export function getInitialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "NA";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getDisplayNameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim() ?? "";
  if (!localPart) {
    return "";
  }

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const roleWorkspaceLabels: Record<AppRole, string> = {
  HR: "HR",
  Technical: "Technical",
  Manager: "Management",
  Admin: "Admin",
};

export type RoleProfile = {
  name: string;
  title: string;
  initials: string;
};

export const roleLandingRoutes: Record<AppRole, string> = {
  HR: "/dashboard",
  Technical: "/dashboard",
  Manager: "/dashboard",
  Admin: "/dashboard",
};

export const roleProfiles: Record<AppRole, RoleProfile> = {
  HR: {
    name: "Jacob Smith",
    title: "HR Recruiter",
    initials: "JS",
  },
  Technical: {
    name: "Sarah Lee",
    title: "Technical Interviewer",
    initials: "SL",
  },
  Manager: {
    name: "Mark Johnson",
    title: "Management Reviewer",
    initials: "MJ",
  },
  Admin: {
    name: "Admin User",
    title: "Platform Admin",
    initials: "AU",
  },
};
