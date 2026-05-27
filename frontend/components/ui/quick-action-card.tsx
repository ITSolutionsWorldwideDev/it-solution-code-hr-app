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
      className="flex w-full items-center justify-between rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,22,28,0.98)_0%,rgba(10,14,18,0.96)_100%)] px-5 py-4 text-left transition hover:border-[#63e7ff]/18 hover:bg-[#182028]"
    >
      <span className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(99,231,255,0.18),rgba(147,239,255,0.12))] text-[#93efff] shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-[1.05rem] font-medium text-[#edf4fa]">
          {buttonLabel || title}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 text-[#93efff]" />
    </Link>
  );
}
