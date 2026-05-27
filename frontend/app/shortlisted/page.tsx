import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ShortlistedPageClient } from "@/components/recruitment/shortlisted-page-client";

export default function ShortlistedPage() {
  return (
    <DashboardShell>
      <ShortlistedPageClient />
    </DashboardShell>
  );
}
