import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CandidateDatabasePageClient } from "@/components/recruitment/candidate-database-page-client";

export default function CandidatesPage() {
  return (
    <DashboardShell showTopBar={false}>
      <CandidateDatabasePageClient />
    </DashboardShell>
  );
}
