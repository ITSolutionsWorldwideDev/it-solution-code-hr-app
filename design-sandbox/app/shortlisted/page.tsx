import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ShortlistedPageClient } from "@/components/recruitment/shortlisted-page-client";

export default function ShortlistedPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white">
            Shortlisted
          </h1>
          <p className="mt-3 text-[1.05rem] text-[#95a8b8]">
            Review the top 10 candidates, decide who receives the HR invitation email, and only then let candidates enter the HR interview flow.
          </p>
        </div>

        <ShortlistedPageClient />
      </div>
    </DashboardShell>
  );
}
