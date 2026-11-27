"use client";

import { useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Globe,
  LoaderCircle,
  MapPin,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PortalJob } from "@/components/recruitment/portal-jobs-table";

type EditPortalJobModalProps = {
  job: PortalJob;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedJob: PortalJob) => void;
};

const PORTAL_COLORS: Record<string, { badge: string; border: string; dot: string }> = {
  itww: {
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    border: "border-sky-500/30",
    dot: "bg-sky-400",
  },
  ish: {
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    border: "border-indigo-500/30",
    dot: "bg-indigo-400",
  },
  dinel: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  },
};

export function EditPortalJobModal({
  job,
  isOpen,
  onClose,
  onSuccess,
}: EditPortalJobModalProps) {
  const [title, setTitle] = useState(job.title || "");
  const [location, setLocation] = useState(job.location || "");
  const [employmentType, setEmploymentType] = useState(job.employment_type || "Full-time");
  const [status, setStatus] = useState(job.status || "published");
  const [department, setDepartment] = useState(job.department || "");
  const [description, setDescription] = useState(job.description || "");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const colors = PORTAL_COLORS[job.portal] || PORTAL_COLORS.itww;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Job title is required.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/integrations/website/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal: job.portal,
          id: job.id,
          title: title.trim(),
          location: location.trim() || null,
          employment_type: employmentType,
          status,
          department: department.trim() || null,
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update job.");
      }

      setSuccessMessage(`Job successfully updated on ${job.portal_label}!`);

      const updatedJob: PortalJob = {
        ...job,
        title: title.trim(),
        location: location.trim() || null,
        employment_type: employmentType,
        status,
        department: department.trim() || null,
        description: description.trim(),
        updated_at: new Date().toISOString(),
      };

      setTimeout(() => {
        onSuccess(updatedJob);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#121922] p-6 shadow-2xl md:p-8`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                {job.portal_label} Portal Job #{job.id}
              </span>
              <span className="text-xs text-[#728696]">Specific Portal Edit</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Edit Job Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#728696] hover:bg-white/5 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informative Guidance Banner */}
        <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-200 leading-relaxed">
          <p className="font-semibold text-sky-100 flex items-center gap-1.5 mb-0.5">
            <Globe className="h-4 w-4 shrink-0 text-sky-400" />
            Independent Portal Customization
          </p>
          Changes made here will strictly update the position on the{" "}
          <strong className="text-white">{job.portal_label}</strong> website. Other
          portals where this job might also be posted will remain unchanged.
        </div>

        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
              Job Title <span className="text-red-400">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-[#728696]" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Amsterdam, Netherlands (Hybrid)"
                  className="h-11 pl-9 rounded-xl border-white/10 bg-[#0c1219] text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
                Employment Type
              </label>
              <Select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Freelance">Freelance</option>
                <option value="Internship">Internship</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
                Publication Status
              </label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-11 rounded-xl border-white/10 bg-[#0c1219] text-white"
              >
                <option value="published">Published (Live)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="closed">Closed / Archived</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf] mb-1.5">
                Department (Optional)
              </label>
              <div className="relative">
                <BriefcaseBusiness className="absolute left-3 top-3 h-4 w-4 text-[#728696]" />
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Sales"
                  className="h-11 pl-9 rounded-xl border-white/10 bg-[#0c1219] text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9bb0bf]">
                Job Description / Markdown Content
              </label>
              <span className="text-[11px] text-[#728696]">
                Supports Markdown (## headings, bullet points)
              </span>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter full job overview, requirements, or responsibilities specific to this portal..."
              rows={8}
              className="rounded-xl border-white/10 bg-[#0c1219] text-white font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border-white/10 bg-white/5 text-[#dae3ee] hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#72d0ed] px-6 text-[#003642] font-semibold hover:bg-[#8adcf4] transition"
            >
              {saving ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                  Saving to {job.portal_label}…
                </>
              ) : (
                `Save Changes to ${job.portal_label}`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
