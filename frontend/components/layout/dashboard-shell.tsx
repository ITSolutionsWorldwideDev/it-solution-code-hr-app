import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-transparent px-3 py-3 text-slate-200 lg:px-4 lg:py-4">
      <div className="flex min-h-[calc(100vh-1.5rem)] w-full overflow-hidden rounded-[34px] border border-white/8 bg-[#11161b] shadow-[0_34px_90px_rgba(0,0,0,0.42)] lg:min-h-[calc(100vh-2rem)]">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-[#161d24] text-slate-200">
          <TopBar />
          <div className="px-5 py-6 lg:px-10 lg:py-8 xl:px-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
