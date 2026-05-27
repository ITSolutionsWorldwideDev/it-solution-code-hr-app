import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OrganogramTree } from "@/components/employees/organogram-tree";
import { buildEmployeeHierarchy, mockCompanyEmployees } from "@/lib/mock/recruitment";

export default function OrganogramPage() {
  const organogramTree = buildEmployeeHierarchy(mockCompanyEmployees);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white">
            Organogram
          </h1>
          <p className="mt-3 text-[1.05rem] text-[#95a8b8]">
            A visual overview of company employees, reporting lines, and manager relationships. Add or remove people in the employee list and the chart updates automatically.
          </p>
        </div>

        <OrganogramTree nodes={organogramTree} />
      </div>
    </DashboardShell>
  );
}
