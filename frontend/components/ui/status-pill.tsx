import { cn } from "@/lib/utils";

type StatusPillProps = {
  status: string;
  tone: "blue" | "green" | "red" | "slate";
};

const toneStyles = {
  blue: "bg-[#466d8a]/20 text-[#9ec5df]",
  green: "bg-[#1b4452]/26 text-[#93efff]",
  red: "bg-[#7f3c45]/22 text-[#efb1b8]",
  slate: "bg-white/8 text-[#aab8c4]",
};

export function StatusPill({ status, tone }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
        toneStyles[tone]
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
