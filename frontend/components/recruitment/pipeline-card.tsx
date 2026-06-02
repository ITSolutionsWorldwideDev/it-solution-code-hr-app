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
  onCardDragStart: (candidateId: string, stage: PipelineCandidateRecord["stage"]) => void;
  onCardDragEnd: () => void;
  isSelected: boolean;
  onCardSelect: (candidateId: string) => void;
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
  onCardDragStart,
  onCardDragEnd,
  isSelected,
  onCardSelect,
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
  const canDragForward = false;

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
          <button
            type="button"
            onClick={() => onApprove(candidate.id)}
            disabled={busy}
            className="w-full rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Saving..." : "Approve Candidate"}
            </span>
          </button>
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
          <button
            type="button"
            onClick={() => onApprove(candidate.id)}
            disabled={busy}
            className="w-full rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Saving..." : "Approve Candidate"}
            </span>
          </button>
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
          <button
            type="button"
            onClick={() => onApprove(candidate.id)}
            disabled={busy}
            className="w-full rounded-[12px] bg-[linear-gradient(135deg,#63e7ff_0%,#93efff_100%)] px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#06141c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? "Saving..." : "Approve Candidate"}
            </span>
          </button>
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
      className={cn(
        "rounded-[20px] border border-white/8 border-l-[3px] bg-[#1d211f] p-4 shadow-[0_16px_28px_rgba(0,0,0,0.28)]",
        isSelected && "border-[#63e7ff]/28 ring-1 ring-[#63e7ff]/18",
        accentClass,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            draggable={canDragForward && !busy}
            onClick={() => onCardSelect(candidate.id)}
            onDragStart={(event) => {
              if (!canDragForward || busy) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", candidate.id);
              onCardDragStart(candidate.id, candidate.stage);
            }}
            onDragEnd={onCardDragEnd}
            className={cn(
              "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/8 bg-[#131716] text-white/48",
              isSelected && "border-[#63e7ff]/25 text-white",
              canDragForward && !busy && "cursor-grab text-white/75 active:cursor-grabbing",
            )}
            aria-label="Select or drag candidate to another stage"
            title="Click to select this card for moving, or drag it to another stage"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div>
            <h3 className="text-[1.08rem] font-semibold text-white">{candidate.name}</h3>
            <p className="mt-1 text-sm text-white/70">{candidate.role}</p>
          </div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#252a28] px-2.5 py-1 text-xs font-semibold text-white/85">
          {candidate.matchScore}% match
        </div>
      </div>

      {canDragForward ? (
        <p className="mt-3 text-[0.68rem] uppercase tracking-[0.18em] text-white/38">
          Click the grip to select this card for moving, or drag it to another stage.
        </p>
      ) : null}

      <div className="mt-5 flex min-h-8 items-center gap-2 text-sm text-white/72">
        {candidate.interviewAt ? (
          <CalendarDays className="h-4 w-4" />
        ) : null}
        <span>{detailCopy}</span>
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
            className="w-full rounded-[12px] border border-[#5a2934] bg-transparent px-3 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.14em] text-[#ffb9c7] transition hover:bg-[#2a171c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Candidate
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link
          href={`/pipeline/${candidate.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-white/72 transition hover:text-white"
        >
          <FileText className="h-4 w-4" />
          View Details
        </Link>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/40">
          <span>{role === "Manager" ? "Management" : role}</span>
        </div>
      </div>

      <div className="mt-4 h-[3px] rounded-full bg-white/8">
        <div
          className={cn(
            "h-full rounded-full",
            candidate.stage === "hr_in_progress" ? "bg-[#63e7ff] w-2/3" : "bg-white/18 w-1/3",
          )}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/45">
        <span>Vacancy {candidate.vacancyId}</span>
        <span>{owner}</span>
      </div>
    </article>
  );
}

export const PipelineCard = memo(PipelineCardComponent);
