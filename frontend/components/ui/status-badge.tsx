import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  tone: "blue" | "green" | "amber";
  children: React.ReactNode;
};

const toneStyles = {
  blue: "bg-brand-50 text-brand-700",
  green: "bg-brand-100 text-brand-700",
  amber: "bg-amber-50 text-amber-700",
};

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        toneStyles[tone]
      )}
    >
      {children}
    </span>
  );
}
