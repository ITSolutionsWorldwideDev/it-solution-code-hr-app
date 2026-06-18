import { useDroppable } from "@dnd-kit/core";
import { CircleX, SearchX } from "lucide-react";

import { PipelineCard } from "@/components/recruitment/pipeline-card";
import type { PipelineCandidateRecord, PipelineStage } from "@/lib/recruitment-types";
import type { AppRole } from "@/lib/session";
import { cn } from "@/lib/utils";

type PipelineColumnProps = {
  stage: PipelineStage;
  label: string;
  owner: string;
  candidates: PipelineCandidateRecord[];
  onMoveForward: (candidateId: string) => void;
  onApprove: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
  onScheduleMeeting: (candidateId: string, scheduledAt: string) => void;
  onSendStageEmail: (
    candidateId: string,
    emailType:
      | "hr_invite"
      | "hr_passed"
      | "hr_rejection"
      | "technical_passed"
      | "technical_rejection"
      | "management_rejection"
      | "offer_sent",
    templateVariant?: "technical_interview_invite" | "hr_interview_rejection",
  ) => void;
  onDeleteFromPipeline: (candidateId: string) => void;
  actionLabel: string;
  role: AppRole;
  canMoveForward: boolean;
  isActiveDropTarget: boolean;
  activeCandidateId: string | null;
  busyApplicationId: string | null;
};

const accentStyles: Record<PipelineStage, string> = {
  applied: "border-white/8 bg-transparent",
  ranked: "border-white/8 bg-transparent",
  shortlisted: "border-white/8 bg-transparent",
  hr_review: "border-white/8 bg-transparent",
  hr_invite_sent: "border-white/8 bg-transparent",
  hr_interview_scheduled: "border-white/8 bg-transparent",
  hr_in_progress: "border-white/8 bg-transparent",
  hr_approved: "border-white/8 bg-transparent",
  hr_passed: "border-white/8 bg-transparent",
  technical_review: "border-white/8 bg-transparent",
  technical_interview_scheduled: "border-white/8 bg-transparent",
  technical_in_progress: "border-white/8 bg-transparent",
  technical_approved: "border-white/8 bg-transparent",
  technical_passed: "border-white/8 bg-transparent",
  management_review: "border-white/8 bg-transparent",
  management_interview_scheduled: "border-white/8 bg-transparent",
  management_in_progress: "border-white/8 bg-transparent",
  selected: "border-white/8 bg-transparent",
  offer_sent: "border-white/8 bg-transparent",
  offer_accepted: "border-white/8 bg-transparent",
  offer_declined: "border-white/8 bg-transparent",
  hired: "border-white/8 bg-transparent",
  rejected: "border-white/8 bg-transparent",
};

export function PipelineColumn({
  stage,
  label,
  owner,
  candidates,
  onMoveForward,
  onApprove,
  onReject,
  onScheduleMeeting,
  onSendStageEmail,
  onDeleteFromPipeline,
  actionLabel,
  role,
  canMoveForward,
  isActiveDropTarget,
  activeCandidateId,
  busyApplicationId,
}: PipelineColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage,
    disabled: busyApplicationId !== null,
  });
  const EmptyIcon = stage === "rejected" ? CircleX : SearchX;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[420px] min-w-0 flex-col gap-4 transition",
        accentStyles[stage],
        isActiveDropTarget && "rounded-xl",
        isOver && "rounded-xl bg-[#102132]/50",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-2">
        <div className="flex items-start gap-2">
          <h2 className="max-w-[220px] truncate whitespace-nowrap font-mono text-[0.82rem] font-medium uppercase leading-5 tracking-[0.16em] text-white/88">
            {label}
          </h2>
          <span className="inline-flex min-w-7 items-center justify-center rounded-md bg-[#313f54] px-2 py-1 text-[10px] font-bold text-[#d8e8f8]">
            {candidates.length}
          </span>
        </div>
        <div className="pt-1 text-[#96a199]">•••</div>
      </div>

      <div className="space-y-4">
        {activeCandidateId && isActiveDropTarget ? (
          <div
            className={cn(
              "rounded-xl border border-dashed px-4 py-3 text-center text-xs uppercase tracking-[0.16em] transition",
              isOver
                ? "border-[#63e7ff]/45 bg-[#162433] text-[#e4fbff]"
                : "border-white/10 bg-[#101a28] text-[#b8dfe8]",
            )}
          >
            {isOver ? `Release to move to ${label.toLowerCase()}` : `Drop here to move to ${label.toLowerCase()}`}
          </div>
        ) : null}

        {candidates.length > 0 ? (
          candidates.map((candidate) => (
            <PipelineCard
              key={candidate.id}
              candidate={candidate}
              onMoveForward={onMoveForward}
              onApprove={onApprove}
              onReject={onReject}
              onScheduleMeeting={onScheduleMeeting}
              onSendStageEmail={onSendStageEmail}
              onDeleteFromPipeline={onDeleteFromPipeline}
              canMoveForward={canMoveForward}
              actionLabel={actionLabel}
              role={role}
              owner={owner}
              busy={busyApplicationId === candidate.id}
            />
          ))
        ) : (
          <div className="flex h-[486px] items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-transparent px-4 py-7 text-center text-sm text-[#98a39d] grayscale">
            <div className="flex flex-col items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 text-white/30">
                <EmptyIcon className="h-8 w-8" />
              </span>
              <span className="text-[1.05rem] text-white/40">No candidates in this stage yet.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
