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
  userId: number | null;
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
  user_id: number;
  email: string;
  role: string;
  name: string;
};

type UserSettingsResponse = {
  profile: {
    preferred_display_name: string;
  };
  preferences: {
    reduced_motion: boolean;
  };
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [session, setSessionState] = useState<SessionUser>({
    userId: 0,
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
        const userSettings = await apiRequest<UserSettingsResponse>({
          path: "/settings/me",
          method: "GET",
        }).catch(() => null);

        if (!isMounted) {
          return;
        }

        const resolvedRole: AppRole = (
          authSession.role === "Admin" ||
          authSession.role === "Manager" ||
          authSession.role === "Technical" ||
          authSession.role === "HR"
        ) ? authSession.role : "HR";
        const resolvedName =
          userSettings?.profile.preferred_display_name ||
          authSession.name ||
          getDisplayNameFromEmail(authSession.email) ||
          roleProfiles[resolvedRole].name;

        if (typeof document !== "undefined") {
          document.documentElement.dataset.reducedMotion = userSettings?.preferences.reduced_motion ? "true" : "false";
        }

        setSessionState({
          userId: authSession.user_id,
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
          userId: 0,
          email: "",
          role: "HR",
          name: roleProfiles.HR.name,
        });
        setIsAuthenticated(false);
        if (typeof document !== "undefined") {
          document.documentElement.dataset.reducedMotion = "false";
        }
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
      userId: session.userId,
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
      userId: 0,
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
      userId: session.userId || null,
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
