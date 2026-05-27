import { LiveRoleDashboard } from "@/components/sandbox/live-role-dashboard";
import { SandboxShell } from "@/components/sandbox/shell";

export default function DashboardPage() {
  return (
    <SandboxShell title="Dashboard" eyebrow="Live workspace">
      <LiveRoleDashboard />
    </SandboxShell>
  );
}
