"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Clock3, HelpCircle, Search } from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { getInitialsFromName, roleProfiles } from "@/lib/session";

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role, name } = useRole();
  const profile = roleProfiles[role];
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (pathname?.startsWith("/candidates")) {
      setSearchValue(searchParams.get("q") ?? "");
      return;
    }

    setSearchValue("");
  }, [pathname, searchParams]);

  const handleSearch = () => {
    const query = searchValue.trim();
    if (!query) {
      router.push("/candidates");
      return;
    }

    router.push(`/candidates?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0b141e] px-6 lg:px-8 xl:px-10">
      <div className="flex min-h-16 flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between xl:py-0">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="flex h-11 w-full max-w-[580px] items-center rounded-full bg-[#222b36] px-5 text-[#dae3f2]">
            <Search className="mr-3 h-5 w-5 shrink-0 text-[#bacac7]" />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="Search candidates, skills, or roles..."
              className="h-full w-full bg-transparent text-[0.98rem] text-[#dae3f2] outline-none placeholder:text-[#859491]"
              aria-label="Search candidates, skills, or roles"
            />
          </div>
        </div>

        <div className="ml-6 flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full p-2 text-[#bacac7] transition hover:bg-[#17202b] hover:text-white"
              aria-label="History"
            >
              <Clock3 className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="relative rounded-full p-2 text-[#bacac7] transition hover:bg-[#17202b] hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-[#0b141e] bg-[#66fcf1]" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-[#bacac7] transition hover:bg-[#17202b] hover:text-white"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <Link
            href="/candidates?tab=bulk_parse"
            className="inline-flex items-center rounded-xl bg-[#222b36] px-6 py-2.5 text-[0.98rem] font-bold text-[#dae3f2] transition hover:brightness-110"
          >
            Bulk Import
          </Link>

          <div className="flex items-center gap-3 pl-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#17202b] text-sm font-semibold text-[#dae3f2]">
              {getInitialsFromName(name)}
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-[#dae3f2]">{name}</p>
              <p className="truncate text-xs text-[#8ea2b3]">{profile.title}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
