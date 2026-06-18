"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { roleProfiles, type AppRole, type SessionUser } from "@/lib/session";

type RoleContextValue = {
  role: AppRole;
  name: string;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setRole: (role: AppRole) => void;
  setSession: (session: SessionUser) => void;
  clearSession: () => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);
const storageKey = "ai-recruitment-session";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [session, setSessionState] = useState<SessionUser>({
    role: "HR",
    name: roleProfiles.HR.name,
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedSession = window.localStorage.getItem(storageKey);

    if (!storedSession) {
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(storedSession) as Partial<SessionUser>;

      if (
        parsed.role &&
        parsed.role in roleProfiles &&
        typeof parsed.name === "string" &&
        parsed.name.trim()
      ) {
        setSessionState({
          role: parsed.role,
          name: parsed.name,
        });
        setIsAuthenticated(true);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const setRole = (nextRole: AppRole) => {
    const nextSession = {
      role: nextRole,
      name: session.name || roleProfiles[nextRole].name,
    };

    setSessionState(nextSession);
    setIsAuthenticated(true);
    window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
  };

  const setSession = (nextSession: SessionUser) => {
    setSessionState(nextSession);
    setIsAuthenticated(true);
    window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
  };

  const clearSession = () => {
    const fallbackSession = {
      role: "HR" as AppRole,
      name: roleProfiles.HR.name,
    };

    setSessionState(fallbackSession);
    setIsAuthenticated(false);
    window.localStorage.removeItem(storageKey);
  };

  const value = useMemo(
    () => ({
      role: session.role,
      name: session.name,
      isAuthenticated,
      isHydrated,
      setRole,
      setSession,
      clearSession,
    }),
    [isAuthenticated, isHydrated, session]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);

  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }

  return context;
}
