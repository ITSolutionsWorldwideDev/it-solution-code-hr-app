import { LoaderCircle, LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  icon?: LucideIcon;
  loading?: boolean;
};

export function Button({
  children,
  className,
  variant = "primary",
  icon: Icon,
  loading = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-[18px] px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] text-[#06141c] shadow-[0_18px_34px_rgba(0,0,0,0.2)] hover:brightness-105"
          : "border border-white/10 bg-[#10161c] text-[#dbe7f0] hover:border-[#63e7ff]/30 hover:bg-[#182028]",
        className
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}
