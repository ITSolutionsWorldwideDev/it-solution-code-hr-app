"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, LoaderCircle, Pencil } from "lucide-react";
import { ensureVacancyFromPortalJob } from "@/lib/portal-sync";
import { EditPortalJobModal } from "@/components/recruitment/edit-portal-job-modal";

export type PortalJob = {
  id: number;
  title: string;
  status: string;
  location: string | null;
  employment_type: string | null;
  experience_level: string | null;
  department: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  portal: string;
  portal_label: string;
};

type PortalConfig = {
  key: string;
  label: string;
  badgeColor: string;
  dotColor: string;
  borderAccent: string;
  headerGradient: string;
};

const PORTAL_CONFIGS: Record<string, PortalConfig> = {
  itww: {
    key: "itww",
    label: "ITWW",
    badgeColor: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    dotColor: "bg-sky-400",
    borderAccent: "border-sky-500/20",
    headerGradient: "from-sky-500/8 to-transparent",
  },
  ish: {
    key: "ish",
    label: "ITSH",
    badgeColor: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    dotColor: "bg-indigo-400",
    borderAccent: "border-indigo-500/20",
    headerGradient: "from-indigo-500/8 to-transparent",
  },
  dinel: {
    key: "dinel",
    label: "Staff Outsourcing",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dotColor: "bg-emerald-400",
    borderAccent: "border-emerald-500/20",
    headerGradient: "from-emerald-500/8 to-transparent",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "published" || s === "active" || s === "open") {
    return "bg-green-500/15 text-green-300 border-green-500/30";
  }
  if (s === "draft") {
    return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  }
  if (s === "closed" || s === "archived" || s === "inactive") {
    return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  }
  return "bg-white/5 text-white/60 border-white/15";
}

type PortalJobsTableProps = {
  portalKey: string;
  jobs: PortalJob[];
  onJobUpdated?: (updatedJob: PortalJob) => void;
};

export function PortalJobsTable({ portalKey, jobs, onJobUpdated }: PortalJobsTableProps) {
  const router = useRouter();
  const [syncingJobId, setSyncingJobId] = useState<number | null>(null);
  const [editingJob, setEditingJob] = useState<PortalJob | null>(null);
  const [localJobs, setLocalJobs] = useState<PortalJob[]>(jobs);
  const config = PORTAL_CONFIGS[portalKey] ?? PORTAL_CONFIGS.itww;

  useEffect(() => {
    setLocalJobs(jobs);
  }, [jobs]);

  const handleJobUpdated = (updated: PortalJob) => {
    setLocalJobs((prev) =>
      prev.map((j) => (j.id === updated.id && j.portal === updated.portal ? updated : j))
    );
    onJobUpdated?.(updated);
  };

  const handleParseCvsForJob = async (job: PortalJob) => {
    setSyncingJobId(job.id);
    try {
      const vacancy = await ensureVacancyFromPortalJob(job);
      router.push(`/candidates?vacancy_id=${vacancy.id}&portal=${job.portal}`);
    } catch (err) {
      console.error("Failed to sync vacancy for parsing:", err);
      // Fallback: navigate directly to candidates page
      router.push(`/candidates?portal=${job.portal}`);
    } finally {
      setSyncingJobId(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)] px-5 py-5 text-sm text-[#95a8b8]">
        No jobs found on {config.label} portal.
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-[30px] border ${config.borderAccent} bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.24)]`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-3 border-b border-white/8 bg-gradient-to-r ${config.headerGradient} px-6 py-4`}
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${config.badgeColor}`}
        >
          <span className={`h-2 w-2 rounded-full ${config.dotColor}`} />
          {config.label}
        </span>
        <span className="text-sm font-medium text-[#eef5fb]">
          Career Portal Jobs
        </span>
        <span className="ml-auto text-xs font-medium text-[#728696]">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1.5fr_0.8fr_0.5fr_0.5fr_0.5fr_0.7fr] gap-4 border-b border-white/8 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#728696]">
        <span>Title</span>
        <span>Department</span>
        <span>Status</span>
        <span>Type</span>
        <span>Published</span>
        <span className="text-right">Action</span>
      </div>

      {/* Rows */}
      {localJobs.map((job) => (
        <div
          key={`${portalKey}-${job.id}`}
          className="grid grid-cols-[1.5fr_0.8fr_0.5fr_0.5fr_0.5fr_0.7fr] items-center gap-4 border-b border-white/6 px-6 py-4 last:border-b-0"
        >
          <div>
            <p className="font-semibold text-white leading-snug">
              {job.title || "Untitled"}
            </p>
            <p className="mt-0.5 text-xs text-[#9bb0bf]">
              {job.location || "Location not set"} •{" "}
              {job.experience_level || "Any level"}
            </p>
          </div>

          <div className="text-sm text-[#eef5fb]">
            {job.department || "—"}
          </div>

          <div>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone(job.status)}`}
            >
              {job.status}
            </span>
          </div>

          <div className="text-xs text-[#9bb0bf]">
            {job.employment_type || "Full-time"}
          </div>

          <div className="text-xs text-[#9bb0bf]">
            {formatDate(job.published_at || job.created_at)}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingJob(job)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[#f4f8fb] transition hover:border-[#7eb9df]/40 hover:bg-[#466d8a]/20 hover:text-white"
              title={`Edit this job specifically on ${config.label}`}
            >
              <Pencil className="h-3.5 w-3.5 text-[#c9e2f2]" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              disabled={syncingJobId === job.id}
              onClick={() => handleParseCvsForJob(job)}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:border-sky-400/40 hover:bg-sky-500/20 disabled:opacity-50"
              title="Upload & Parse CVs for this position"
            >
              {syncingJobId === job.id ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  <span>Preparing…</span>
                </>
              ) : (
                <>
                  <FileUp className="h-3.5 w-3.5" />
                  <span>Parse CVs</span>
                </>
              )}
            </button>
          </div>
        </div>
      ))}

      {editingJob && (
        <EditPortalJobModal
          job={editingJob}
          isOpen={Boolean(editingJob)}
          onClose={() => setEditingJob(null)}
          onSuccess={handleJobUpdated}
        />
      )}
    </div>
  );
}

type PortalJobsData = {
  itww: PortalJob[];
  ish: PortalJob[];
  dinel: PortalJob[];
  total: number;
};

type PortalJobsSectionProps = {
  data: PortalJobsData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onJobUpdated?: (updatedJob: PortalJob) => void;
};

export function PortalJobsSection({
  data,
  loading,
  error,
  onRetry,
  onJobUpdated,
}: PortalJobsSectionProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#728696]">
          Career Portal Jobs
        </h3>
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)] px-5 py-8 text-center text-sm text-[#95a8b8]">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          <p className="mt-2">Loading portal jobs…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#728696]">
          Career Portal Jobs
        </h3>
        <div className="flex items-center justify-between gap-4 rounded-[24px] border border-amber-500/25 bg-amber-500/8 px-5 py-4 text-sm text-amber-200">
          <span>Portal jobs: {error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#728696]">
          Career Portal Jobs
        </h3>
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)] px-5 py-5 text-sm text-[#95a8b8]">
          No jobs found on any career portal.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#728696]">
          Career Portal Jobs
        </h3>
        <span className="text-xs font-medium text-[#728696]">
          {data.total} total across portals
        </span>
      </div>

      {data.itww.length > 0 && (
        <PortalJobsTable portalKey="itww" jobs={data.itww} onJobUpdated={onJobUpdated} />
      )}
      {data.ish.length > 0 && (
        <PortalJobsTable portalKey="ish" jobs={data.ish} onJobUpdated={onJobUpdated} />
      )}
      {data.dinel.length > 0 && (
        <PortalJobsTable portalKey="dinel" jobs={data.dinel} onJobUpdated={onJobUpdated} />
      )}
    </div>
  );
}
