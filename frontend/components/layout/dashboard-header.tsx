import { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type HeaderAction = {
  label: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary";
};

type DashboardHeaderProps = {
  title: string;
  subtitle: string;
  actions?: HeaderAction[];
};

export function DashboardHeader({
  title,
  subtitle,
  actions = [],
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-5 border-b border-line pb-8 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">
          Recruitment Dashboard
        </p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant ?? "primary"}
            icon={action.icon}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
