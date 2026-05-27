"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { HiringRequestForm } from "@/components/recruitment/hiring-request-form";
import { HiringRequestList } from "@/components/recruitment/hiring-request-list";
import { Panel } from "@/components/ui/panel";
import { mockHiringRequests } from "@/lib/mock/recruitment";

export function RoleAwareHiringRequests() {
  const { role } = useRole();

  if (role === "Technical") {
    return (
      <Panel className="rounded-[30px] border-[#dfe9f3] p-6 shadow-sm">
        <h2 className="text-[1.5rem] font-semibold text-[#1d2c44]">
          Hiring requests are not part of the technical workspace
        </h2>
        <p className="mt-3 max-w-3xl text-[1rem] leading-7 text-[#6c7f96]">
          In your workflow, technical users join after HR approval. Use the pipeline to review technical-round candidates and submit interview feedback.
        </p>
        <Link
          href="/pipeline"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#edf5ff] px-4 py-3 text-sm font-semibold text-[#2b69b0]"
        >
          Open Pipeline
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Panel>
    );
  }

  if (role === "Manager") {
    return (
      <Panel className="rounded-[30px] border-[#dfe9f3] p-6 shadow-sm">
        <h2 className="text-[1.5rem] font-semibold text-[#1d2c44]">
          Job description intake stays in the HR workspace
        </h2>
        <p className="mt-3 max-w-3xl text-[1rem] leading-7 text-[#6c7f96]">
          Management joins later in the flow. Use the pipeline to review technically approved finalists, track selection decisions, and monitor offer progress.
        </p>
        <Link
          href="/pipeline"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#edf5ff] px-4 py-3 text-sm font-semibold text-[#2b69b0]"
        >
          Open Pipeline
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Panel>
    );
  }

  if (role === "Admin") {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <HiringRequestForm />
        <HiringRequestList items={mockHiringRequests} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <HiringRequestForm />
      <HiringRequestList items={mockHiringRequests} />
    </div>
  );
}
