import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RoleAwareJobDescriptionStudio } from "@/components/recruitment/role-aware-job-description-studio";

export default function HiringRequestsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="rounded-[24px] border border-[#18252c] bg-[radial-gradient(circle_at_top_left,rgba(24,216,234,0.08),transparent_32%),linear-gradient(180deg,rgba(12,15,17,0.96)_0%,rgba(9,11,12,0.98)_100%)] px-6 py-7 shadow-[0_24px_48px_rgba(0,0,0,0.26)]">
          <div className="inline-flex items-center rounded-[8px] border border-[#1b808e] bg-[rgba(8,39,44,0.78)] px-3 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.24em] text-[#1dd8ea]">
            Recruitment Command Center
          </div>
          <h1 className="mt-5 text-[2.7rem] font-semibold tracking-[-0.04em] text-white">
            Job Description
          </h1>
          <p className="mt-3 max-w-3xl text-[1.05rem] leading-8 text-[#95a8b8]">
            Use AI to turn a short role brief into a polished job description draft and start the HR intake flow.
          </p>
        </div>

        <RoleAwareJobDescriptionStudio />
      </div>
    </DashboardShell>
  );
}
