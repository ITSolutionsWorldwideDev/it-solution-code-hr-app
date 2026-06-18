"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { PipelineColumn } from "@/components/recruitment/pipeline-column";
import { pipelineStageLabels, pipelineStageOrder } from "@/lib/pipeline";
import type { PipelineCandidateRecord, PipelineStage } from "@/lib/recruitment-types";
import type { AppRole } from "@/lib/session";

type PipelineBoardProps = {
  candidates: PipelineCandidateRecord[];
  visibleStages?: PipelineStage[];
  role: AppRole;
  onMoveForward: (candidateId: string) => void;
  onApprove: (candidateId: string) => void;
  onMoveToStage: (candidateId: string, targetStage: PipelineStage) => void;
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
  busyApplicationId: string | null;
};

const movableStagesByRole: Record<AppRole, PipelineStage[]> = {
  HR: ["hr_invite_sent", "hr_in_progress"],
  Technical: ["technical_in_progress"],
  Manager: ["management_in_progress", "selected", "offer_sent", "offer_accepted"],
  Admin: [
    "hr_invite_sent",
    "hr_in_progress",
    "technical_in_progress",
    "management_in_progress",
    "selected",
    "offer_sent",
    "offer_accepted",
  ],
};

const actionLabels: Partial<Record<PipelineStage, string>> = {
  hr_in_progress: "Approve To Technical Pipeline",
  technical_in_progress: "Approve To Management Pipeline",
  management_in_progress: "Select Candidate",
  selected: "Send Offer",
  offer_sent: "Mark Accepted",
  offer_accepted: "Mark Hired",
};

const ownerLabels: Record<PipelineStage, string> = {
  applied: "AI Intake",
  ranked: "AI Ranking",
  shortlisted: "HR",
  hr_review: "HR",
  hr_invite_sent: "HR",
  hr_interview_scheduled: "HR",
  hr_in_progress: "HR",
  hr_approved: "Technical",
  hr_passed: "Technical",
  technical_review: "Technical",
  technical_interview_scheduled: "Technical",
  technical_in_progress: "Technical",
  technical_approved: "Management",
  technical_passed: "Management",
  management_review: "Management",
  management_interview_scheduled: "Management",
  management_in_progress: "Management",
  selected: "Management",
  offer_sent: "Management",
  offer_accepted: "HR / Onboarding",
  offer_declined: "Management",
  hired: "HR / Onboarding",
  rejected: "Closed",
};

export function PipelineBoard({
  candidates,
  visibleStages,
  role,
  onMoveForward,
  onApprove,
  onMoveToStage,
  onReject,
  onScheduleMeeting,
  onSendStageEmail,
  onDeleteFromPipeline,
  busyApplicationId,
}: PipelineBoardProps) {
  const activeStages = visibleStages ?? pipelineStageOrder;
  const movableStages = movableStagesByRole[role];
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const groupedCandidates = useMemo(() => {
    return activeStages.map((stage) => ({
      stage,
      label: pipelineStageLabels[stage],
      owner: ownerLabels[stage],
      candidates: candidates.filter((candidate) => candidate.stage === stage),
    }));
  }, [activeStages, candidates]);

  const activeCandidate =
    activeCandidateId !== null
      ? candidates.find((candidate) => candidate.id === activeCandidateId) ?? null
      : null;

  const handleDragStart = (event: DragStartEvent) => {
    if (busyApplicationId !== null) {
      return;
    }

    setActiveCandidateId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const candidateId = activeCandidateId;
    setActiveCandidateId(null);

    if (!candidateId || busyApplicationId !== null) {
      return;
    }

    const targetStage = event.over?.id;
    if (!targetStage || typeof targetStage !== "string") {
      return;
    }

    const currentCandidate = candidates.find((candidate) => candidate.id === candidateId);
    if (!currentCandidate || currentCandidate.stage === targetStage) {
      return;
    }

    onMoveToStage(candidateId, targetStage as PipelineStage);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-3">
        <div
          className="mx-auto grid min-w-[1120px] max-w-[1560px] items-start gap-6"
          style={{ gridTemplateColumns: `repeat(${groupedCandidates.length}, minmax(0, 1fr))` }}
        >
          {groupedCandidates.map((column) => (
            <PipelineColumn
              key={column.stage}
              stage={column.stage}
              label={column.label}
              owner={column.owner}
              candidates={column.candidates}
              onMoveForward={onMoveForward}
              onApprove={onApprove}
              onReject={onReject}
              onScheduleMeeting={onScheduleMeeting}
              onSendStageEmail={onSendStageEmail}
              onDeleteFromPipeline={onDeleteFromPipeline}
              actionLabel={actionLabels[column.stage] ?? "Approve"}
              role={role}
              canMoveForward={movableStages.includes(column.stage)}
              isActiveDropTarget={activeCandidate?.stage !== column.stage && activeCandidate !== null}
              activeCandidateId={activeCandidateId}
              busyApplicationId={busyApplicationId}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCandidate ? (
          <div className="w-[320px] rounded-[20px] border border-[#63e7ff]/25 bg-[#20283a] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)] opacity-95">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[1.05rem] font-semibold text-white">{activeCandidate.name}</p>
                <p className="mt-1 text-sm text-white/72">{activeCandidate.role}</p>
              </div>
              <div className="rounded-[10px] border border-white/10 bg-[#2b3748] px-2.5 py-1 text-xs font-semibold text-white/85">
                {activeCandidate.matchScore}% match
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
