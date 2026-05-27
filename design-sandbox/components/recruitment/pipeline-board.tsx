"use client";

import { useMemo } from "react";

import { pipelineStageLabels, pipelineStageOrder } from "@/lib/pipeline";
import type { AppRole } from "@/lib/session";
import type { PipelineCandidateRecord, PipelineStage } from "@/lib/recruitment-types";

import { PipelineColumn } from "@/components/recruitment/pipeline-column";

type PipelineBoardProps = {
  candidates: PipelineCandidateRecord[];
  visibleStages?: PipelineStage[];
  role: AppRole;
  onMoveForward: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
};

const movableStagesByRole: Record<AppRole, PipelineStage[]> = {
  HR: ["hr_invite_sent", "hr_interview_scheduled", "hr_in_progress"],
  Technical: ["technical_interview_scheduled", "technical_in_progress"],
  Manager: ["management_interview_scheduled", "management_in_progress", "selected", "offer_sent", "offer_accepted"],
  Admin: [
    "hr_invite_sent",
    "hr_interview_scheduled",
    "hr_in_progress",
    "technical_interview_scheduled",
    "technical_in_progress",
    "management_interview_scheduled",
    "management_in_progress",
    "selected",
    "offer_sent",
    "offer_accepted",
  ],
};

const actionLabels: Partial<Record<PipelineStage, string>> = {
  hr_invite_sent: "Candidate Approved",
  hr_interview_scheduled: "Start HR Interview",
  hr_in_progress: "Mark HR Passed",
  technical_interview_scheduled: "Start Technical Interview",
  technical_in_progress: "Mark Technical Passed",
  management_interview_scheduled: "Start Management Interview",
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

export function PipelineBoard({ candidates, visibleStages, role, onMoveForward, onReject }: PipelineBoardProps) {
  const activeStages = visibleStages ?? pipelineStageOrder;
  const movableStages = movableStagesByRole[role];

  const groupedCandidates = useMemo(() => {
    return activeStages.map((stage) => ({
      stage,
      label: pipelineStageLabels[stage],
      owner: ownerLabels[stage],
      candidates: candidates.filter((candidate) => candidate.stage === stage),
    }));
  }, [activeStages, candidates]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-3">
        {groupedCandidates.slice(0, 3).map((column) => (
          <PipelineColumn
            key={column.stage}
            stage={column.stage}
            label={column.label}
            owner={column.owner}
            candidates={column.candidates}
            onMoveForward={onMoveForward}
            onReject={onReject}
            actionLabel={actionLabels[column.stage] ?? "Move Forward"}
            role={role}
            canMoveForward={movableStages.includes(column.stage)}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {groupedCandidates.slice(3).map((column) => (
          <PipelineColumn
            key={column.stage}
            stage={column.stage}
            label={column.label}
            owner={column.owner}
            candidates={column.candidates}
            onMoveForward={onMoveForward}
            onReject={onReject}
            actionLabel={actionLabels[column.stage] ?? "Move Forward"}
            role={role}
            canMoveForward={movableStages.includes(column.stage)}
          />
        ))}
      </div>
    </div>
  );
}
