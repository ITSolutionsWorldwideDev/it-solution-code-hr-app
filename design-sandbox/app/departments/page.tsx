import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Panel } from "@/components/ui/panel";

const mockDepartments = [
  { name: "Engineering", openRoles: 6 },
  { name: "Product", openRoles: 3 },
  { name: "Data", openRoles: 2 },
  { name: "Operations", openRoles: 1 },
];

export default function DepartmentsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white">
            Departments
          </h1>
          <p className="mt-3 text-[1.05rem] text-[#95a8b8]">
            A simple department overview with placeholder data until live backend connections are added.
          </p>
        </div>

        <Panel className="rounded-[30px] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {mockDepartments.map((department) => (
              <div
                key={department.name}
                className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5"
              >
                <p className="text-[1.08rem] font-semibold text-white">
                  {department.name}
                </p>
                <p className="mt-2 text-sm text-[#95a8b8]">
                  Open roles: {department.openRoles}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
