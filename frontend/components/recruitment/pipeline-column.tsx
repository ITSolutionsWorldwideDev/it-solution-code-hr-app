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
  onApprove: (candidateId: string) => void;
  onMoveToStage: (targetStage: PipelineStage) => void;
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
  canDropHere: boolean;
  isDragging: boolean;
  onCardDragStart: (candidateId: string, stage: PipelineStage) => void;
  onCardDragEnd: () => void;
  selectedCandidateId: string | null;
  onCardSelect: (candidateId: string) => void;
  busyApplicationId: string | null;
};

const accentStyles: Record<PipelineStage, string> = {
  applied: "border-white/8 bg-[#161a18]",
  ranked: "border-white/8 bg-[#161a18]",
  shortlisted: "border-white/8 bg-[#161a18]",
  hr_review: "border-white/8 bg-[#161a18]",
  hr_invite_sent: "border-white/8 bg-[#161a18]",
  hr_interview_scheduled: "border-white/8 bg-[#161a18]",
  hr_in_progress: "border-white/8 bg-[#161a18]",
  hr_approved: "border-white/8 bg-[#161a18]",
  hr_passed: "border-white/8 bg-[#161a18]",
  technical_review: "border-white/8 bg-[#161a18]",
  technical_interview_scheduled: "border-white/8 bg-[#161a18]",
  technical_in_progress: "border-white/8 bg-[#161a18]",
  technical_approved: "border-white/8 bg-[#161a18]",
  technical_passed: "border-white/8 bg-[#161a18]",
  management_review: "border-white/8 bg-[#161a18]",
  management_interview_scheduled: "border-white/8 bg-[#161a18]",
  management_in_progress: "border-white/8 bg-[#161a18]",
  selected: "border-white/8 bg-[#161a18]",
  offer_sent: "border-white/8 bg-[#161a18]",
  offer_accepted: "border-white/8 bg-[#161a18]",
  offer_declined: "border-white/8 bg-[#161a18]",
  hired: "border-white/8 bg-[#161a18]",
  rejected: "border-white/8 bg-[#161a18]",
};

export function PipelineColumn({
  stage,
  label,
  owner,
  candidates,
  onMoveForward,
  onApprove,
  onMoveToStage,
  onReject,
  onScheduleMeeting,
  onSendStageEmail,
  onDeleteFromPipeline,
  actionLabel,
  role,
  canMoveForward,
  canDropHere,
  isDragging,
  onCardDragStart,
  onCardDragEnd,
  selectedCandidateId,
  onCardSelect,
  busyApplicationId,
}: PipelineColumnProps) {
  const isBusy = busyApplicationId !== null;

  return (
    <section
      onDragOver={(event) => {
        if (canDropHere && !isBusy) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (canDropHere && !isBusy) {
          onMoveToStage(stage);
        }
      }}
      className={cn(
        "flex min-h-[360px] min-w-[286px] flex-col rounded-[26px] border p-4 shadow-[0_18px_36px_rgba(0,0,0,0.18)] transition",
        canDropHere && isDragging && "border-[#63e7ff]/35 bg-[#182028]",
        accentStyles[stage],
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9rem] font-medium uppercase tracking-[0.14em] text-white/88">{label}</h2>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#96a199]">
            {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-[#7f8a83]">•••</div>
      </div>

      <div className="space-y-3">
        {canDropHere && isDragging ? (
          <div className="rounded-[16px] border border-dashed border-[#63e7ff]/30 bg-[#151d24] px-4 py-3 text-center text-xs uppercase tracking-[0.16em] text-[#d9f8ff]">
            Drop here to move to {label.toLowerCase()}
          </div>
        ) : null}

        {canDropHere ? (
          <button
            type="button"
            onClick={() => onMoveToStage(stage)}
            disabled={!isDragging || isBusy}
            className={cn(
              "w-full rounded-[16px] border px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] transition",
              isDragging && !isBusy
                ? "border-[#63e7ff]/28 bg-[#182028] text-[#e0f9ff] hover:bg-[#1d2730]"
                : "border-white/8 bg-[#131716] text-[#748078]",
            )}
          >
            {isDragging ? `Move selected card to ${label}` : `Drop zone: ${label}`}
          </button>
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
              onCardDragStart={onCardDragStart}
              onCardDragEnd={onCardDragEnd}
              isSelected={selectedCandidateId === candidate.id}
              onCardSelect={onCardSelect}
              busy={busyApplicationId === candidate.id}
            />
          ))
        ) : (
          <div className="rounded-[18px] border border-dashed border-white/10 bg-[#111413] px-4 py-7 text-center text-sm text-[#98a39d]">
            No candidates in this stage yet.
          </div>
        )}
      </div>
    </section>
  );
}
