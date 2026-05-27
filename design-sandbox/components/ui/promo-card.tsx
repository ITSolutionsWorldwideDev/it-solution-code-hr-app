import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FilePlus2, Headphones, Users } from "lucide-react";

const links = [
  { label: "Create Hiring Request", icon: FilePlus2, href: "/hiring-requests" },
  { label: "View Vacancies", icon: BriefcaseBusiness, href: "/vacancies" },
  { label: "View Candidates", icon: Users, href: "/candidates" },
];

export function PromoCard() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-[#dfe9f3] bg-white">
      <div className="relative h-[160px] overflow-hidden border-b border-[#e6eef6] bg-gradient-to-br from-[#f1f8ff] via-white to-[#d9eaf8]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.95),transparent_25%),linear-gradient(135deg,rgba(255,255,255,0.82),rgba(199,224,244,0.45))]" />
        <div className="absolute right-8 top-7 flex h-24 w-24 items-center justify-center rounded-full bg-white/75 text-[#2b76ab] shadow-sm backdrop-blur">
          <Headphones className="h-10 w-10" />
        </div>
        <div className="absolute left-6 bottom-5 rounded-[22px] border border-white/80 bg-white/76 px-5 py-4 shadow-sm backdrop-blur">
          <div className="text-[0.78rem] font-semibold uppercase tracking-[0.28em] text-[#2b76ab]">
            AI Hiring
          </div>
          <div className="mt-1 text-[1.15rem] font-semibold text-[#18314d]">
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
              className="flex w-full items-center justify-between text-left text-[#1d2c44]"
            >
              <span className="flex items-center gap-3 text-[1.05rem]">
                <Icon className="h-5 w-5 text-[#2b76ab]" />
                {item.label}
              </span>
              <ArrowRight className="h-4 w-4 text-[#2b76ab]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
