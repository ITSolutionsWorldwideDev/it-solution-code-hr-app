import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#0a0c10] px-0 py-0 text-slate-200">
      <div className="flex min-h-screen w-full overflow-hidden bg-[#0a0c10] shadow-[0_30px_90px_rgba(0,0,0,0.48)]">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-[#0a0c10] text-slate-200">
          <TopBar />
          <div className="px-6 py-6 lg:px-10 lg:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
