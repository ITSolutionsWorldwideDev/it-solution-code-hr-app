export const appRoles = ["HR", "Technical", "Manager", "Admin"] as const;
export const prototypeRoles = ["HR", "Technical", "Manager"] as const;

export type AppRole = (typeof appRoles)[number];

export type SessionUser = {
  name: string;
  role: AppRole;
};

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
