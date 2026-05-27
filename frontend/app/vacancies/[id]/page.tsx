import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VacancyDetailPageClient } from "@/components/recruitment/vacancy-detail-page-client";

type VacancyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function VacancyDetailPage({
  params,
}: VacancyDetailPageProps) {
  const { id } = await params;

  return (
    <DashboardShell>
      <VacancyDetailPageClient id={id} />
    </DashboardShell>
  );
}
