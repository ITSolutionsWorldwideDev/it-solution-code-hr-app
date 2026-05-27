import type { AppRole } from "@/lib/session";
import type { PipelineCandidateRecord, PipelineStage } from "@/lib/recruitment-types";
import { cn } from "@/lib/utils";

import { PipelineCard } from "@/components/recruitment/pipeline-card";

type PipelineColumnProps = {
  stage: PipelineStage;
  label: string;
  owner: string;
  candidates: PipelineCandidateRecord[];
  onMoveForward: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
  actionLabel: string;
  role: AppRole;
  canMoveForward: boolean;
};

const accentStyles: Record<PipelineStage, string> = {
  applied: "border-[#7eb9df]/16 bg-white/[0.03]",
  ranked: "border-[#6eaed1]/16 bg-white/[0.03]",
  shortlisted: "border-[#7eb9df]/18 bg-white/[0.032]",
  hr_review: "border-[#7eb9df]/18 bg-white/[0.032]",
  hr_invite_sent: "border-[#7eb9df]/18 bg-[#0f1720]",
  hr_interview_scheduled: "border-[#7eb9df]/18 bg-white/[0.032]",
  hr_in_progress: "border-[#7eb9df]/18 bg-white/[0.032]",
  hr_approved: "border-[#66a387]/18 bg-white/[0.03]",
  hr_passed: "border-[#66a387]/18 bg-white/[0.03]",
  technical_review: "border-[#7eb9df]/14 bg-white/[0.028]",
  technical_interview_scheduled: "border-[#7eb9df]/14 bg-white/[0.028]",
  technical_in_progress: "border-[#7eb9df]/14 bg-white/[0.028]",
  technical_approved: "border-[#66a387]/18 bg-white/[0.03]",
  technical_passed: "border-[#66a387]/18 bg-white/[0.03]",
  management_review: "border-white/10 bg-white/[0.026]",
  management_interview_scheduled: "border-white/10 bg-white/[0.026]",
  management_in_progress: "border-white/10 bg-white/[0.026]",
  selected: "border-[#b6ab70]/20 bg-white/[0.03]",
  offer_sent: "border-[#7eb9df]/18 bg-white/[0.03]",
  offer_accepted: "border-[#6fb58c]/20 bg-[#0d1512]",
  offer_declined: "border-[#9c6870]/18 bg-[#140d10]",
  hired: "border-[#70b28e]/18 bg-[#0d1512]",
  rejected: "border-[#9c6870]/18 bg-[#140d10]",
};

export function PipelineColumn({
  stage,
  label,
  owner,
  candidates,
  onMoveForward,
  onReject,
  actionLabel,
  role,
  canMoveForward,
}: PipelineColumnProps) {
  return (
    <section
      className={cn(
        "flex min-h-[280px] flex-col rounded-[28px] border p-4 shadow-[0_18px_36px_rgba(0,0,0,0.18)]",
        accentStyles[stage]
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.05rem] font-semibold text-white">{label}</h2>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8ea2b3]">
            {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#9fc6e0]">
          {owner}
        </div>
      </div>

      <div className="space-y-3">
        {candidates.length > 0 ? (
          candidates.map((candidate) => (
            <PipelineCard
              key={candidate.id}
              candidate={candidate}
              onMoveForward={onMoveForward}
              onReject={onReject}
              canMoveForward={canMoveForward}
              actionLabel={actionLabel}
              role={role}
              owner={owner}
            />
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-white/12 bg-white/[0.03] px-4 py-7 text-center text-sm text-[#8ea2b3]">
            No candidates in this stage yet.
          </div>
        )}
      </div>
    </section>
  );
}
