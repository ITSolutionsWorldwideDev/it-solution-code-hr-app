import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FilePlus2, Headphones, Users } from "lucide-react";

const links = [
  { label: "Create Hiring Request", icon: FilePlus2, href: "/hiring-requests" },
  { label: "View Vacancies", icon: BriefcaseBusiness, href: "/vacancies" },
  { label: "View Candidates", icon: Users, href: "/candidates" },
];

export function PromoCard() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(19,23,22,0.98)_0%,rgba(28,32,31,0.94)_100%)] shadow-[0_20px_40px_rgba(0,0,0,0.26)]">
      <div className="relative h-[160px] overflow-hidden border-b border-white/8 bg-[radial-gradient(circle_at_10%_10%,rgba(98,232,168,0.2),transparent_26%),linear-gradient(135deg,#191d1b_0%,#242926_58%,#1b211d_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_45%)]" />
        <div className="absolute right-8 top-7 flex h-24 w-24 items-center justify-center rounded-full bg-[linear-gradient(145deg,rgba(99,231,255,0.18),rgba(147,239,255,0.12))] text-[#63e7ff] shadow-[0_18px_36px_rgba(0,0,0,0.22)] backdrop-blur">
          <Headphones className="h-10 w-10" />
        </div>
        <div className="absolute left-6 bottom-5 rounded-[22px] border border-white/10 bg-[#151917]/88 px-5 py-4 shadow-sm backdrop-blur">
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.28em] text-[#63e7ff]">
            AI Hiring
          </div>
          <div className="mt-1 text-[1.15rem] font-semibold text-white">
            Recruitment Operations
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex w-full items-center justify-between text-left text-white/88"
            >
              <span className="flex items-center gap-3 text-[1.05rem]">
                <Icon className="h-5 w-5 text-[#63e7ff]" />
                {item.label}
              </span>
              <ArrowRight className="h-4 w-4 text-[#63e7ff]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
