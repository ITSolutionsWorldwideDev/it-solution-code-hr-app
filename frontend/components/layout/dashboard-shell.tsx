"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { useAppScale } from "@/components/providers/app-scale-provider";
import { useRole } from "@/components/providers/role-provider";

type DashboardShellProps = {
  children: React.ReactNode;
  showTopBar?: boolean;
};

export function DashboardShell({ children, showTopBar = true }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { scale } = useAppScale();
  const { isAuthenticated, isHydrated } = useRole();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
    }
  }, [isAuthenticated, isHydrated, pathname, router]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b141e] px-6 text-[#95a8b8]">
        Loading secure workspace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div data-app-scale={scale} className="app-scale-shell min-h-screen bg-[#0b141e] text-[#dae3f2]">
      <div className="flex min-h-screen w-full overflow-hidden bg-[#0b141e]">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-[#0b141e] text-[#dae3f2]">
          {showTopBar ? <TopBar /> : null}
          <div className="px-6 py-6 lg:px-8 lg:py-8 xl:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
