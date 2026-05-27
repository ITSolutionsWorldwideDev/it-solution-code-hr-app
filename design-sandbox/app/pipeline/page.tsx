import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RolePipelineView } from "@/components/recruitment/role-pipeline-view";

export default function PipelinePage() {
  return (
    <DashboardShell>
      <RolePipelineView />
    </DashboardShell>
  );
}
