import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import type { AppRole } from "@/lib/session";
import type { PipelineCandidateRecord } from "@/lib/recruitment-types";

type PipelineCardProps = {
  candidate: PipelineCandidateRecord;
  onMoveForward: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
  canMoveForward: boolean;
  actionLabel: string;
  role: AppRole;
  owner: string;
};

export function PipelineCard({
  candidate,
  onMoveForward,
  onReject,
  canMoveForward,
  actionLabel,
  role,
  owner,
}: PipelineCardProps) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-[#0b0f14] p-4 shadow-[0_14px_30px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1rem] font-semibold text-[#edf4fa]">{candidate.name}</h3>
          <p className="mt-1 text-sm text-[#91a5b6]">{candidate.role}</p>
        </div>
        <div className="rounded-full bg-[#466d8a]/18 px-3 py-1 text-xs font-semibold text-[#9fc6e0]">
          {candidate.matchScore}% match
        </div>
      </div>

      <div className="mt-4 rounded-[18px] bg-white/[0.04] px-3 py-2 text-sm text-[#91a5b6]">
        Vacancy: {candidate.vacancyId}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[#89a4b8]">
        <span>Current owner</span>
        <span className="font-semibold text-[#dbe8f2]">{owner}</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link
          href={`/pipeline/${candidate.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#9fc6e0] transition hover:text-white"
        >
          <FileText className="h-4 w-4" />
          View details
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onReject(candidate.id)}
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[#a5b5c2] transition hover:bg-white/[0.05]"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onMoveForward(candidate.id)}
            disabled={!canMoveForward}
            className="inline-flex items-center gap-1 rounded-full bg-[#466d8a]/18 px-3 py-2 text-xs font-semibold text-[#9fc6e0] transition hover:bg-[#466d8a]/28 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-[#7f93a5]">
        Visible in the {role === "Manager" ? "Management" : role} workspace because this stage is currently owned there.
      </p>
    </article>
  );
}
