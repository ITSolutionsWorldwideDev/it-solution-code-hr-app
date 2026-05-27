import { LucideIcon, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "sky" | "slate";
};

const toneStyles = {
  blue: "bg-[#466d8a]/20 text-[#9ec5df]",
  green: "bg-[#2d6b52]/24 text-[#9fd0b5]",
  sky: "bg-[#466d8a]/18 text-[#9ec5df]",
  slate: "bg-white/8 text-[#b8c6d2]",
};

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  tone,
}: KpiCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.015)_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 text-[#93b9d3]">
            <Icon className="h-5 w-5" />
            <p className="text-[2.05rem] font-semibold tracking-tight text-white">
              {value}
            </p>
          </div>
          <p className="mt-4 text-[0.98rem] font-medium text-[#d8e3ec]">{label}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl",
            toneStyles[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-1.5 text-sm text-[#94a8b8]">
        <TrendingUp className="h-3.5 w-3.5 text-[#93b9d3]" />
        <span>{delta}</span>
      </div>
    </div>
  );
}
