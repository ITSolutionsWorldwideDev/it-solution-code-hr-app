"use client";

import { useMemo, useState } from "react";

import { pipelineStageLabels, pipelineStageOrder } from "@/lib/pipeline";
import type { AppRole } from "@/lib/session";
import type { PipelineCandidateRecord, PipelineStage } from "@/lib/recruitment-types";

import { PipelineColumn } from "@/components/recruitment/pipeline-column";

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
  HR: ["hr_in_progress"],
  Technical: ["technical_in_progress"],
  Manager: ["management_in_progress", "selected", "offer_sent", "offer_accepted"],
  Admin: [
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
  const [draggingCandidateId, setDraggingCandidateId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const groupedCandidates = useMemo(() => {
    return activeStages.map((stage) => ({
      stage,
      label: pipelineStageLabels[stage],
      owner: ownerLabels[stage],
      candidates: candidates.filter((candidate) => candidate.stage === stage),
    }));
  }, [activeStages, candidates]);

  const handleDragStart = (candidateId: string, _stage: PipelineStage) => {
    setDraggingCandidateId(candidateId);
    setSelectedCandidateId(candidateId);
  };

  const handleDragEnd = () => {
    setDraggingCandidateId(null);
  };

  const handleCardSelect = (candidateId: string) => {
    setSelectedCandidateId((current) => (current === candidateId ? null : candidateId));
  };

  const handleDropToStage = (targetStage: PipelineStage) => {
    const candidateId = draggingCandidateId ?? selectedCandidateId;
    if (!candidateId || busyApplicationId !== null) {
      handleDragEnd();
      return;
    }

    onMoveToStage(candidateId, targetStage);
    handleDragEnd();
    setSelectedCandidateId(null);
  };

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex min-w-max gap-4">
        {groupedCandidates.map((column) => (
          <PipelineColumn
            key={column.stage}
            stage={column.stage}
            label={column.label}
            owner={column.owner}
            candidates={column.candidates}
            onMoveForward={onMoveForward}
            onApprove={onApprove}
            onMoveToStage={handleDropToStage}
            onReject={onReject}
            onScheduleMeeting={onScheduleMeeting}
            onSendStageEmail={onSendStageEmail}
            onDeleteFromPipeline={onDeleteFromPipeline}
            actionLabel={actionLabels[column.stage] ?? "Approve"}
            role={role}
            canMoveForward={movableStages.includes(column.stage)}
            canDropHere={Boolean(draggingCandidateId || selectedCandidateId)}
            isDragging={Boolean(draggingCandidateId || selectedCandidateId)}
            onCardDragStart={handleDragStart}
            onCardDragEnd={handleDragEnd}
            selectedCandidateId={selectedCandidateId}
            onCardSelect={handleCardSelect}
            busyApplicationId={busyApplicationId}
          />
        ))}
      </div>
    </div>
  );
}
