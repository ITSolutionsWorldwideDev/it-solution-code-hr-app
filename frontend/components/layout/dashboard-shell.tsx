import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#0b141c] text-slate-200">
      <div className="flex min-h-screen w-full overflow-hidden bg-[#0b141c]">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-[#0b141c] text-slate-200">
          <TopBar />
          <div className="px-5 py-6 lg:px-8 lg:py-8 xl:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
