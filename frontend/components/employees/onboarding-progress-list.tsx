import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import type { EmployeeRecord } from "@/lib/recruitment-types";

type OnboardingProgressListProps = {
  employees: EmployeeRecord[];
};

const toneMap = {
  not_started: "slate",
  in_progress: "blue",
  completed: "green",
} as const;

function getCompletion(employee: EmployeeRecord): number {
  let completedSteps = 0;

  if (employee.signedOffer) completedSteps += 1;
  if (employee.documentsStatus === "completed") completedSteps += 1;
  if (employee.startDate) completedSteps += 1;
  if (employee.onboardingStatus === "completed") completedSteps += 1;

  return Math.round((completedSteps / 4) * 100);
}

export function OnboardingProgressList({ employees }: OnboardingProgressListProps) {
  return (
    <div className="space-y-4">
      {employees.map((employee) => {
        const completion = getCompletion(employee);

        return (
          <Panel key={employee.id} className="rounded-[28px] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[1.2rem] font-semibold text-white">
                    {employee.fullName}
                  </h2>
                  <StatusPill
                    status={employee.onboardingStatus}
                    tone={toneMap[employee.onboardingStatus]}
                  />
                </div>
                <p className="mt-2 text-sm text-[#95a8b8]">
                  {employee.role} · {employee.department}
                </p>
                <p className="mt-1 text-sm text-[#95a8b8]">
                  Manager: {employee.managerName ?? "No manager assigned"}
                </p>
              </div>

              <div className="min-w-[170px]">
                <p className="text-sm font-medium text-[#9ab0c0]">Onboarding progress</p>
                <div className="mt-3 h-3 rounded-full bg-white/8">
                  <div
                    className="h-3 rounded-full bg-[#6f9fc3]"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-[#9ab0c0]">{completion}% complete</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold text-[#9ab0c0]">Documents</p>
                <p className="mt-2 text-[1rem] text-[#edf4fa]">{employee.documentsStatus}</p>
              </div>
              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold text-[#9ab0c0]">Signed offer</p>
                <p className="mt-2 text-[1rem] text-[#edf4fa]">
                  {employee.signedOffer ? "Yes" : "No"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold text-[#9ab0c0]">Start date</p>
                <p className="mt-2 text-[1rem] text-[#edf4fa]">
                  {employee.startDate ?? "Not scheduled yet"}
                </p>
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
