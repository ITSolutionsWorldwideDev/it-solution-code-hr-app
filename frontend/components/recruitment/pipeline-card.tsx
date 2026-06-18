import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { memo, useState } from "react";
import { CalendarDays, FileText, GripVertical, LoaderCircle } from "lucide-react";

import type { AppRole } from "@/lib/session";
import type { PipelineCandidateRecord } from "@/lib/recruitment-types";
import { cn } from "@/lib/utils";

type PipelineCardProps = {
  candidate: PipelineCandidateRecord;
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
  canMoveForward: boolean;
  actionLabel: string;
  role: AppRole;
  owner: string;
  busy: boolean;
};

function toLocalDateTimeInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatLocalInterviewDate(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function PipelineCardComponent({
  candidate,
  onMoveForward,
  onApprove,
  onReject,
  onScheduleMeeting,
  onSendStageEmail,
  onDeleteFromPipeline,
  canMoveForward,
  actionLabel,
  role,
  owner,
  busy,
}: PipelineCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formattedInterviewAt = formatLocalInterviewDate(candidate.interviewAt);

  const detailCopy =
    candidate.stage === "hr_invite_sent"
      ? "Invitation sent. The candidate can now choose an open interview slot from the scheduling email."
      : candidate.stage === "hr_interview_scheduled"
        ? `Interview scheduled for ${formattedInterviewAt}` 
        : candidate.stage === "hr_in_progress"
        ? formattedInterviewAt
          ? `Interview scheduled for ${formattedInterviewAt}. Record the outcome here after the meeting.`
          : "Waiting for the candidate to choose an interview slot."
          : candidate.stage === "hr_passed"
            ? role === "HR"
              ? "Candidate was approved by HR and is now waiting for the technical invitation."
              : "Candidate was sent by HR to Technical. Send the technical scheduling invite when you are ready."
            : candidate.stage === "technical_interview_scheduled"
              ? `Interview scheduled for ${formattedInterviewAt}`
            : candidate.stage === "technical_in_progress"
              ? formattedInterviewAt
                ? `Interview scheduled for ${formattedInterviewAt}. Record the outcome here after the meeting.`
                : "Waiting for the candidate to choose a technical interview slot."
            : candidate.stage === "technical_passed"
              ? role === "Technical"
                ? "Candidate was approved by Technical and is now waiting for the management invitation."
                : "Candidate passed the technical stage. Send the management interview invite when you are ready."
              : candidate.stage === "management_interview_scheduled"
                ? `Interview scheduled for ${formattedInterviewAt}`
              : candidate.stage === "management_in_progress"
                ? formattedInterviewAt
                  ? `Interview scheduled for ${formattedInterviewAt}. Record the outcome here after the meeting.`
                  : "Waiting for the candidate to choose a management interview slot."
              : candidate.stage === "selected"
                ? "Candidate was approved by management. You can now send the onboarding email."
            : candidate.applicationStage === "hr_rejected"
              ? candidate.rejectionEmailSent
                ? "Candidate rejected after the HR interview. The rejection email was sent."
                : "Candidate rejected after the HR interview. You can send the post-interview rejection email."
              : candidate.applicationStage === "technical_rejected"
                ? candidate.rejectionEmailSent
                  ? "Candidate rejected after the technical interview. The rejection email was sent."
                  : "Candidate rejected after the technical interview. You can send the technical rejection email."
                : candidate.applicationStage === "management_rejected"
                  ? candidate.rejectionEmailSent
                    ? "Candidate rejected after the management stage. The rejection email was sent."
                    : "Candidate rejected after the management stage. You can send the management rejection email."
              : `Owned by ${owner}`;

  const accentClass =
    candidate.stage === "hr_in_progress" || candidate.stage === "technical_in_progress" || candidate.stage === "management_in_progress"
      ? "border-l-[#63e7ff]"
      : candidate.interviewAt
        ? "border-l-[#93efff]"
        : "border-l-white/16";
  const canDragForward =
    !busy &&
    candidate.stage !== "hired" &&
    candidate.stage !== "offer_declined";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
    disabled: !canDragForward,
    data: {
      stage: candidate.stage,
    },
  });
  const dragStyle = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const renderActions = () => {
    if (candidate.stage === "hr_invite_sent") {
      return (
        <div className="mt-5 rounded-[12px] border border-white/10 bg-[#10161c] px-4 py-3 text-sm text-white/72">
          Waiting for the candidate to confirm an open slot from the scheduling link.
        </div>
      );
    }

    if (candidate.stage === "hr_interview_scheduled") {
      return (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onApprove(candidate.id)}
            disabled={!canMoveForward || busy}
            className="rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Saving..." : "Approve"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onReject(candidate.id)}
            disabled={busy}
            className="rounded-[12px] border border-white/10 bg-[#10161c] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-white/82 transition hover:bg-[#182028]"
          >
            Reject
          </button>
        </div>
      );
    }

    if (candidate.stage === "hr_in_progress") {
      return (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onMoveForward(candidate.id)}
            disabled={!canMoveForward || busy}
            className="rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Saving..." : actionLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onReject(candidate.id)}
            disabled={busy}
            className="rounded-[12px] border border-white/10 bg-[#10161c] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-white/82 transition hover:bg-[#182028]"
          >
            Reject
          </button>
        </div>
      );
    }

    if (candidate.stage === "technical_in_progress") {
      return (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onApprove(candidate.id)}
            disabled={!canMoveForward || busy}
            className="rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Saving..." : actionLabel}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onReject(candidate.id)}
            disabled={busy}
            className="rounded-[12px] border border-white/10 bg-[#10161c] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-white/82 transition hover:bg-[#182028]"
          >
            Reject
          </button>
        </div>
      );
    }

    if (candidate.stage === "hr_passed") {
      return (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => onSendStageEmail(candidate.id, "hr_passed", "technical_interview_invite")}
            disabled={busy}
            className="w-full rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Sending..." : "Send Technical Invite"}
            </span>
          </button>
        </div>
      );
    }

    if (candidate.stage === "technical_passed") {
      return (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => onSendStageEmail(candidate.id, "technical_passed")}
            disabled={busy}
            className="w-full rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Sending..." : "Send Management Invite"}
            </span>
          </button>
        </div>
      );
    }

    if (candidate.stage === "selected") {
      return (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => onSendStageEmail(candidate.id, "offer_sent")}
            disabled={busy}
            className="w-full rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Sending..." : "Send Onboarding Email"}
            </span>
          </button>
        </div>
      );
    }

    if (candidate.applicationStage === "hr_rejected") {
      return (
        <div className="mt-5 space-y-3">
          {candidate.rejectionEmailSent ? (
            <div className="mb-3 rounded-[10px] border border-[#315545] bg-[#15271d] px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-[#cdeed8]">
              Rejection email sent
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onSendStageEmail(candidate.id, "hr_rejection", "hr_interview_rejection")}
            disabled={busy}
            className="w-full rounded-[12px] border border-white/10 bg-[#10161c] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-white/82 transition hover:bg-[#182028] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy
                ? "Sending..."
                : candidate.rejectionEmailSent
                  ? "Resend Post-Interview Rejection"
                  : "Send Post-Interview Rejection"}
            </span>
          </button>
        </div>
      );
    }

    if (candidate.applicationStage === "technical_rejected") {
      return (
        <div className="mt-5 space-y-3">
          {candidate.rejectionEmailSent ? (
            <div className="mb-3 rounded-[10px] border border-[#315545] bg-[#15271d] px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-[#cdeed8]">
              Rejection email sent
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onSendStageEmail(candidate.id, "technical_rejection")}
            disabled={busy}
            className="w-full rounded-[12px] border border-white/10 bg-[#10161c] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-white/82 transition hover:bg-[#182028] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy
                ? "Sending..."
                : candidate.rejectionEmailSent
                  ? "Resend Technical Rejection"
                  : "Send Technical Rejection"}
            </span>
          </button>
        </div>
      );
    }

    if (candidate.applicationStage === "management_rejected") {
      return (
        <div className="mt-5 space-y-3">
          {candidate.rejectionEmailSent ? (
            <div className="mb-3 rounded-[10px] border border-[#315545] bg-[#15271d] px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-[#cdeed8]">
              Rejection email sent
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onSendStageEmail(candidate.id, "management_rejection")}
            disabled={busy}
            className="w-full rounded-[12px] border border-white/10 bg-[#10161c] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-white/82 transition hover:bg-[#182028] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy
                ? "Sending..."
                : candidate.rejectionEmailSent
                  ? "Resend Management Rejection"
                  : "Send Management Rejection"}
            </span>
          </button>
        </div>
      );
    }

    return (
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onMoveForward(candidate.id)}
          disabled={!canMoveForward || busy}
          className="rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            {busy ? "Saving..." : actionLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onReject(candidate.id)}
          disabled={busy}
          className="rounded-[12px] border border-white/10 bg-[#10161c] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-white/82 transition hover:bg-[#182028]"
        >
          Reject
        </button>
      </div>
    );
  };

  return (
      <article
        ref={setNodeRef}
        style={dragStyle}
        className={cn(
          "h-[486px] rounded-xl border border-white/10 bg-[rgba(30,41,59,0.4)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-sm transition",
          isDragging && "opacity-50 shadow-[0_20px_44px_rgba(0,0,0,0.30)]",
          !isDragging && "hover:border-[#8aebff]/30",
        )}
      >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            {...listeners}
            {...attributes}
            className={cn(
              "mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#273647] text-[#859397]",
              canDragForward && !busy && "cursor-grab text-white/75 active:cursor-grabbing",
            )}
            aria-label="Drag candidate to another stage"
            title="Drag candidate to another stage"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div>
            <h3 className="text-[1.08rem] font-bold text-white">{candidate.name}</h3>
            <p className="mt-1 text-[12px] text-[#bbc9cd]">{candidate.role}</p>
          </div>
        </div>
        <div className="rounded-md border border-[#22d3ee]/20 bg-[#22d3ee]/10 px-2.5 py-1 text-[10px] font-bold text-[#8aebff]">
          {candidate.matchScore}% match
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[14px] leading-8 text-[#d4e4fa]/80">{detailCopy}</p>
      </div>

      {renderActions()}

      <div className="mt-3">
        {showDeleteConfirm ? (
          <div className="rounded-[16px] border border-[#5d2a33] bg-[#2a171c] px-4 py-3">
            <p className="text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#ffccd6]">
              Remove from pipeline?
            </p>
            <p className="mt-2 text-sm leading-6 text-[#ffd8df]">
              Are you sure? This will delete the candidate from the pipeline only. The stored candidate profile, CV,
              and database record will stay available.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={busy}
                className="rounded-[12px] border border-white/10 bg-[#10161c] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-white/82 transition hover:bg-[#182028] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onDeleteFromPipeline(candidate.id)}
                disabled={busy}
                className="rounded-[12px] bg-[#f0b8c1] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#241015] transition hover:bg-[#f7c8d0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                  {busy ? "Deleting..." : "Delete Candidate"}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={busy}
            className="w-full rounded-lg border border-[#ffb4ab]/30 bg-transparent px-3 py-2 text-[14px] font-semibold uppercase tracking-tight text-[#ffb4ab] transition hover:bg-[#93000a]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Candidate
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <Link
          href={`/pipeline/${candidate.id}`}
          className="inline-flex items-center gap-2 text-[14px] font-medium text-[#8aebff] transition hover:underline"
        >
          <FileText className="h-4 w-4" />
          View Details
        </Link>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
          <span>{role === "Manager" ? "Management" : role}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-white/40">
        <span>Vacancy {candidate.vacancyId}</span>
        <span>{owner}</span>
      </div>
    </article>
  );
}

export const PipelineCard = memo(PipelineCardComponent);
