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
  blue: "bg-[#63e7ff]/16 text-[#b8f5ff]",
  green: "bg-[#2c5a6b]/24 text-[#a8efff]",
  sky: "bg-[#63e7ff]/16 text-[#d8f8ff]",
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
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(19,24,31,0.98)_0%,rgba(24,31,38,0.94)_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 text-[#63e7ff]">
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
        <TrendingUp className="h-3.5 w-3.5 text-[#63e7ff]" />
        <span>{delta}</span>
      </div>
    </div>
  );
}
