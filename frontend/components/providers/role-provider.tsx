"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiRequest } from "@/lib/api/client";
import { getDisplayNameFromEmail, roleProfiles, type AppRole, type SessionUser } from "@/lib/session";

type RoleContextValue = {
  email: string;
  role: AppRole;
  name: string;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setRole: (role: AppRole) => void;
  setSession: (session: SessionUser) => void;
  clearSession: () => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

type AuthSessionResponse = {
  email: string;
  role: string;
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [session, setSessionState] = useState<SessionUser>({
    email: "",
    role: "HR",
    name: roleProfiles.HR.name,
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      try {
        const authSession = await apiRequest<AuthSessionResponse>({
          path: "/auth/me",
          method: "GET",
        });

        if (!isMounted) {
          return;
        }

        const resolvedRole: AppRole = "HR";
        const resolvedName = getDisplayNameFromEmail(authSession.email) || roleProfiles.HR.name;

        setSessionState({
          email: authSession.email,
          role: resolvedRole,
          name: resolvedName,
        });
        setIsAuthenticated(true);
      } catch {
        if (!isMounted) {
          return;
        }

        setSessionState({
          email: "",
          role: "HR",
          name: roleProfiles.HR.name,
        });
        setIsAuthenticated(false);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const setRole = (nextRole: AppRole) => {
    const nextSession = {
      email: session.email,
      role: nextRole,
      name: session.name || roleProfiles[nextRole].name,
    };

    setSessionState(nextSession);
  };

  const setSession = (nextSession: SessionUser) => {
    setSessionState(nextSession);
    setIsAuthenticated(true);
  };

  const clearSession = () => {
    void apiRequest({
      path: "/auth/logout",
      method: "POST",
    }).catch(() => undefined);

    const fallbackSession: SessionUser = {
      email: "",
      role: "HR",
      name: roleProfiles.HR.name,
    };

    setSessionState(fallbackSession);
    setIsAuthenticated(false);
  };

  const value = useMemo(
    () => ({
      email: session.email,
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
