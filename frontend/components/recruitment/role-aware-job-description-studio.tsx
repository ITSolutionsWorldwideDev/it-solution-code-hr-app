"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { Panel } from "@/components/ui/panel";
import { JobDescriptionStudio } from "@/components/recruitment/job-description-studio";

export function RoleAwareJobDescriptionStudio() {
  const { role } = useRole();

  if (role === "HR") {
    return <JobDescriptionStudio />;
  }

  return (
    <Panel className="rounded-[30px] p-6">
      <h2 className="text-[1.5rem] font-semibold text-white">
        Job description intake stays in the HR workspace
      </h2>
      <p className="mt-3 max-w-3xl text-[1rem] leading-7 text-[#95a8b8]">
        This prototype keeps job description generation and vacancy intake with HR. Your workspace stays focused on the pipeline stages that start after HR hands candidates forward.
      </p>
      <Link
        href="/pipeline"
        className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[#7eb9df]/20 bg-[#466d8a]/16 px-4 py-3 text-sm font-semibold text-[#b5d1e4]"
      >
        Open Pipeline
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Panel>
  );
}
