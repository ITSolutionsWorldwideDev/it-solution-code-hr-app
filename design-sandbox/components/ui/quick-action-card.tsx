import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";

type QuickActionCardProps = {
  title: string;
  description: string;
  buttonLabel: string;
  icon: LucideIcon;
  href: string;
};

export function QuickActionCard({
  title,
  buttonLabel,
  icon: Icon,
  href,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-between rounded-[1.15rem] border border-white/8 bg-white/[0.035] px-5 py-4 text-left transition hover:bg-white/[0.06]"
    >
      <span className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#466d8a]/18 text-[#9bc3de] shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[1.05rem] font-medium text-[#edf4fa]">
          {buttonLabel || title}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 text-[#9bc3de]" />
    </Link>
  );
}
