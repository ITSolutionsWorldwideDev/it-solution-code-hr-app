import { SandboxShell } from "@/components/sandbox/shell";
import { RoleAwareJobDescriptionStudio } from "@/components/recruitment/role-aware-job-description-studio";

export default function HiringRequestsPage() {
  return (
    <SandboxShell title="Job Description" eyebrow="Live workspace">
      <div className="space-y-6">
        <p className="max-w-3xl text-[1.02rem] leading-8 text-[#9eb1c1]">
          Use AI to turn a short role brief into a polished job description draft and start the HR intake flow.
        </p>

        <RoleAwareJobDescriptionStudio />
      </div>
    </SandboxShell>
  );
}
