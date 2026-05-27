import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  icon?: LucideIcon;
};

export function Button({
  children,
  className,
  variant = "primary",
  icon: Icon,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
        variant === "primary"
          ? "bg-[#466d8a] text-white shadow-[0_16px_36px_rgba(70,109,138,0.34)] hover:bg-[#517995]"
          : "border border-white/12 bg-white/[0.04] text-[#dbe7f0] hover:border-[#7eb9df]/25 hover:bg-white/[0.07]",
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}
