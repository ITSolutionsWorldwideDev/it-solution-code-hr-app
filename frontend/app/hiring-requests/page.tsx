import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RoleAwareJobDescriptionStudio } from "@/components/recruitment/role-aware-job-description-studio";

export default function HiringRequestsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white">
            Job Description
          </h1>
          <p className="mt-3 text-[1.05rem] text-[#95a8b8]">
            Use AI to turn a short role brief into a polished job description draft and start the HR intake flow.
          </p>
        </div>

        <RoleAwareJobDescriptionStudio />
      </div>
    </DashboardShell>
  );
}
