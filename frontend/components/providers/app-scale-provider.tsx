"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AppScale = "67" | "85" | "100";

type AppScaleContextValue = {
  scale: AppScale;
};

const defaultScale: AppScale = "100";

const AppScaleContext = createContext<AppScaleContextValue | null>(null);

export function AppScaleProvider({ children }: { children: ReactNode }) {
  return <AppScaleContext.Provider value={{ scale: defaultScale }}>{children}</AppScaleContext.Provider>;
}

export function useAppScale() {
  const context = useContext(AppScaleContext);

  if (!context) {
    throw new Error("useAppScale must be used within an AppScaleProvider");
  }

  return context;
}
