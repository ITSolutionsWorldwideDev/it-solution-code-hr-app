import type { AppRole } from "@/lib/session";

export type AuthRole = Extract<AppRole, "HR" | "Technical" | "Admin">;

export type MockUser = {
  email: string;
  password: string;
  name: string;
  role: AuthRole;
};

export const users: MockUser[] = [
  {
    email: "bob@itsolutions.com",
    password: "password123",
    name: "Bob",
    role: "HR",
  },
  {
    email: "james@itsolutions.com",
    password: "password123",
    name: "James",
    role: "Technical",
  },
  {
    email: "sarah@itsolutions.com",
    password: "password123",
    name: "Sarah",
    role: "Admin",
  },
];
