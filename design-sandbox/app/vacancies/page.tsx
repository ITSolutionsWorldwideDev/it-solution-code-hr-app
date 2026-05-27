import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VacanciesPageClient } from "@/components/recruitment/vacancies-page-client";

export default function VacanciesPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white">
            Vacancies
          </h1>
          <p className="mt-3 text-[1.05rem] text-[#95a8b8]">
            View active and historical vacancy records. Open a vacancy to inspect its details and live candidate rankings.
          </p>
        </div>

        <VacanciesPageClient />
      </div>
    </DashboardShell>
  );
}
