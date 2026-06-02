"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";

import { apiRequest } from "@/lib/api/client";

type PublicCandidateScheduleProps = {
  applicationId: string;
};

type PublicScheduleRecord = {
  application_id: number;
  candidate_name: string;
  candidate_email: string;
  vacancy_title: string;
  stage: string;
  stage_type: "hr" | "technical" | "management";
  invite_sent_at: string | null;
  scheduled_at: string | null;
  available_slots: string[];
  schedule_timezone: string;
};

type PublicScheduleResponse = {
  application_id: number;
  stage: string;
  stage_type: "hr" | "technical" | "management";
  scheduled_at: string;
  message: string;
};

function defaultScheduleValue(record?: PublicScheduleRecord | null) {
  if (record?.scheduled_at) {
    return record.scheduled_at;
  }

  return record?.available_slots[0] ?? "";
}

function stageTypeLabel(stageType: PublicScheduleRecord["stage_type"]) {
  if (stageType === "technical") {
    return "technical";
  }
  if (stageType === "management") {
    return "management";
  }
  return "HR";
}

function formatDateTime(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "full",
    timeStyle: "short",
    hour12: false,
    timeZone,
  }).format(new Date(value));
}

export function PublicCandidateSchedule({ applicationId }: PublicCandidateScheduleProps) {
  const [record, setRecord] = useState<PublicScheduleRecord | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await apiRequest<PublicScheduleRecord>({
          path: `/applications/public-schedule/${applicationId}`,
        });
        setRecord(response);
        setScheduledAt(defaultScheduleValue(response));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not load the schedule page.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [applicationId]);

  const formattedExistingInterview = useMemo(() => {
    if (!record?.scheduled_at) {
      return null;
    }

    return new Intl.DateTimeFormat("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
      timeZone: record.schedule_timezone,
    }).format(new Date(record.scheduled_at));
  }, [record?.scheduled_at, record?.schedule_timezone]);

  const handleSubmit = async () => {
    if (!scheduledAt) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<PublicScheduleResponse>({
        path: `/applications/public-schedule/${applicationId}`,
        method: "POST",
        body: JSON.stringify({
          scheduled_at: scheduledAt,
        }),
      });

      setRecord((current) =>
        current
          ? {
              ...current,
              stage: response.stage,
              stage_type: response.stage_type,
              scheduled_at: response.scheduled_at,
              available_slots: current.available_slots.filter((slot) => slot !== response.scheduled_at),
            }
          : current,
      );
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save your preferred time.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-8 text-sm text-white/65">
        Loading your schedule page...
      </div>
    );
  }

  if (errorMessage && !record) {
    return (
      <div className="rounded-[24px] border border-[#6b3041] bg-[#2a1620] px-6 py-8 text-sm text-[#ffb9c7]">
        {errorMessage}
      </div>
    );
  }

  if (!record) {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#9db8ff]">
            Candidate Schedule
          </p>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-white">
            Choose your {stageTypeLabel(record.stage_type)} interview time
          </h1>
          <p className="mt-3 max-w-2xl text-[0.98rem] leading-7 text-[#c7d4df]">
            Hi {record.candidate_name}, please choose the time that works best for your {stageTypeLabel(record.stage_type)} interview for the{" "}
            {record.vacancy_title} role.
          </p>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-black/40 px-4 py-3 text-right">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white/45">Email</p>
          <p className="mt-1 text-sm text-white">{record.candidate_email}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-[20px] border border-white/10 bg-black/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-[#9db8ff]" />
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/45">Current stage</p>
              <p className="mt-1 text-sm text-white">{record.stage}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-white/10 bg-black/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <Clock3 className="h-4 w-4 text-[#9db8ff]" />
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/45">
                Already scheduled
              </p>
              <p className="mt-1 text-sm text-white">{formattedExistingInterview ?? "Not scheduled yet"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-[24px] border border-white/10 bg-black/35 p-5">
        <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white/55">
          Pick one of the open slots
        </label>
        <p className="mt-2 text-sm leading-6 text-[#aab7c2]">
          These times come from the connected calendar, so you can only choose a currently open interview slot.
        </p>

        <div className="mt-4 grid gap-3">
          {record.available_slots.length ? (
            record.available_slots.map((slot) => {
              const active = scheduledAt === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setScheduledAt(slot)}
                  className={`rounded-[14px] border px-4 py-3 text-left transition ${
                    active
                      ? "border-[#9db8ff] bg-[#9db8ff]/12 text-white"
                      : "border-white/10 bg-[#090909] text-[#d7e1ea] hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="block text-sm font-semibold">{formatDateTime(slot, record.schedule_timezone)}</span>
                  <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-white/45">
                    {record.schedule_timezone}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="rounded-[14px] border border-white/10 bg-[#090909] px-4 py-4 text-sm text-[#d7e1ea]">
              No open slots are available right now. Please try again later or contact the hiring team.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !scheduledAt || !record.available_slots.length}
          className="mt-4 inline-flex h-12 items-center justify-center rounded-[10px] bg-white px-6 text-sm font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Confirm interview time"}
        </button>
      </div>

      {successMessage ? (
        <div className="mt-5 rounded-[16px] border border-white/12 bg-[#141414] px-4 py-3 text-sm text-white/82">
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-[16px] border border-[#6b3041] bg-[#2a1620] px-4 py-3 text-sm text-[#ffb9c7]">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
