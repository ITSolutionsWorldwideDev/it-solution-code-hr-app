import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OnboardingProgressList } from "@/components/employees/onboarding-progress-list";
import { mockOnboardingEmployees } from "@/lib/mock/recruitment";

export default function OnboardingPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white">
            Onboarding
          </h1>
          <p className="mt-3 text-[1.05rem] text-[#95a8b8]">
            Track document collection, signed offers, start dates, and onboarding progress for new employees.
          </p>
        </div>

        <OnboardingProgressList employees={mockOnboardingEmployees} />
      </div>
    </DashboardShell>
  );
}
