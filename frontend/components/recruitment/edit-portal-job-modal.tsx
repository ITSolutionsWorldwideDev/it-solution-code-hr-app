"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  Building,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  ListChecks,
  LoaderCircle,
  MapPin,
  Sparkles,
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

function extractSectionsFromRaw(rawText: string) {
  if (!rawText) {
    return {
      aboutRole: "",
      responsibilities: "",
      requirements: "",
      offers: "",
      extras: "",
    };
  }

  const lines = rawText.split("\n");
  let currentSection = "about";
  const aboutLines: string[] = [];
  const resps: string[] = [];
  const reqs: string[] = [];
  const offers: string[] = [];
  const extras: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cleanHeading = trimmed.replace(/^[#*_\s]+|[#*_\s:]+$/g, "").toLowerCase();

    if (
      cleanHeading === "about the role" ||
      cleanHeading === "position overview" ||
      cleanHeading === "about us" ||
      cleanHeading.startsWith("about it solutions") ||
      cleanHeading === "functieoverzicht" ||
      cleanHeading === "role overview"
    ) {
      currentSection = "about";
      continue;
    } else if (
      cleanHeading === "what you'll do" ||
      cleanHeading === "what you’ll do" ||
      cleanHeading === "key responsibilities" ||
      cleanHeading === "responsibilities" ||
      cleanHeading === "core responsibilities" ||
      cleanHeading === "taken" ||
      cleanHeading === "taken & verantwoordelijkheden"
    ) {
      currentSection = "resp";
      continue;
    } else if (
      cleanHeading === "what you'll bring" ||
      cleanHeading === "what you’ll bring" ||
      cleanHeading === "requirements" ||
      cleanHeading === "skills & requirements" ||
      cleanHeading === "skills" ||
      cleanHeading === "qualifications" ||
      cleanHeading === "vereisten" ||
      cleanHeading === "wat wij zoeken" ||
      cleanHeading === "wat wij vragen" ||
      cleanHeading === "tools & platforms (preferred)"
    ) {
      currentSection = "req";
      continue;
    } else if (
      cleanHeading === "what we offer" ||
      cleanHeading === "nice to have" ||
      cleanHeading === "wat wij bieden" ||
      cleanHeading === "aanbod" ||
      cleanHeading === "perks" ||
      cleanHeading === "benefits"
    ) {
      currentSection = "offer";
      continue;
    } else if (
      cleanHeading === "additional information" ||
      cleanHeading === "additional info" ||
      cleanHeading === "aanvullende informatie" ||
      cleanHeading === "trainings- en ontwikkelprogramma"
    ) {
      currentSection = "extra";
      continue;
    }

    if (/^\d{1,2}$/.test(trimmed)) continue;
    const bullet = trimmed.replace(/^[-*•\d+.)]+\s*/, "").trim();
    if (!bullet) continue;

    if (currentSection === "about") {
      aboutLines.push(trimmed);
    } else if (currentSection === "resp") {
      resps.push(bullet);
    } else if (currentSection === "req") {
      reqs.push(bullet);
    } else if (currentSection === "offer") {
      offers.push(bullet);
    } else if (currentSection === "extra") {
      extras.push(bullet);
    }
  }

  return {
    aboutRole: aboutLines.join("\n\n"),
    responsibilities: resps.join("\n"),
    requirements: reqs.join("\n"),
    offers: offers.join("\n"),
    extras: extras.join("\n"),
  };
}

export function EditPortalJobModal({
  job,
  isOpen,
  onClose,
  onSuccess,
}: EditPortalJobModalProps) {
  // Pre-parse structured content
  const initialStructured = useMemo(() => {
    // If Dinel provided specific columns, use them directly
    if (
      job.intro_information ||
      job.vacancy_information ||
      job.requirements ||
      job.offer_information
    ) {
      return {
        aboutRole: job.intro_information || "",
        responsibilities: job.vacancy_information || "",
        requirements: job.requirements || "",
        offers: job.offer_information || "",
        extras: job.additional_information || "",
      };
    }
    // Otherwise parse from raw description/content
    return extractSectionsFromRaw(job.description || "");
  }, [job]);

  // Extract work model and employment type
  const rawType = job.employment_type || "Full-time";
  const initialEmpType = rawType.split("•")[0]?.trim() || "Full-time";
  const initialWorkModel =
    job.workplace_type ||
    (rawType.toLowerCase().includes("remote")
      ? "Remote"
      : rawType.toLowerCase().includes("onsite") || rawType.toLowerCase().includes("on-site")
      ? "On-site"
      : "Hybrid");

  const [activeTab, setActiveTab] = useState<"structured" | "raw">("structured");

  // Basic Information
  const [title, setTitle] = useState(job.title || "");
  const [department, setDepartment] = useState(job.department || "");
  const [location, setLocation] = useState(job.location || "");
  const [employmentType, setEmploymentType] = useState(initialEmpType);
  const [workModel, setWorkModel] = useState(initialWorkModel);
  const [experienceLevel, setExperienceLevel] = useState(
    job.experience_level ? job.experience_level.toUpperCase() : "MID"
  );
  const [hoursPerWeek, setHoursPerWeek] = useState(
    job.hours_per_week ? String(job.hours_per_week) : "40"
  );
  const [status, setStatus] = useState(job.status || "published");

  // Structured Content Fields
  const [aboutRole, setAboutRole] = useState(initialStructured.aboutRole);
  const [responsibilities, setResponsibilities] = useState(initialStructured.responsibilities);
  const [requirements, setRequirements] = useState(initialStructured.requirements);
  const [offerInformation, setOfferInformation] = useState(initialStructured.offers);
  const [additionalInformation, setAdditionalInformation] = useState(initialStructured.extras);

  // Raw Markdown
  const [rawDescription, setRawDescription] = useState(job.description || "");

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
          department: department.trim() || null,
          location: location.trim() || null,
          employment_type: employmentType,
          workplace_type: workModel,
          work_model: workModel,
          experience_level: experienceLevel,
          hours_per_week: Number(hoursPerWeek) || 40,
          status,
          // Structured content
          about_role: aboutRole.trim(),
          responsibilities: responsibilities.trim(),
          requirements: requirements.trim(),
          offer_information: offerInformation.trim(),
          additional_information: additionalInformation.trim(),
          // Raw description fallback if on raw tab
          description: activeTab === "raw" ? rawDescription.trim() : null,
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
        department: department.trim() || null,
        location: location.trim() || null,
        employment_type: `${employmentType} • ${workModel}`,
        workplace_type: workModel,
        experience_level: experienceLevel,
        hours_per_week: Number(hoursPerWeek) || 40,
        status,
        intro_information: aboutRole.trim(),
        vacancy_information: responsibilities.trim(),
        requirements: requirements.trim(),
        offer_information: offerInformation.trim(),
        additional_information: additionalInformation.trim(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-white/10 bg-[#121922] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:px-7 md:py-5 bg-[#0f141c]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                {job.portal_label} Portal Job #{job.id}
              </span>
              <span className="text-xs text-[#728696]">Full Job Customization</span>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
              Edit Job Vacancy
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
        <div className="px-5 md:px-7 pt-4 pb-1">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-200 leading-relaxed flex items-start gap-2.5">
            <Globe className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
            <div>
              <span className="font-semibold text-sky-100">Independent Portal Customization: </span>
              Changes made here strictly update the position on the{" "}
              <strong className="text-white">{job.portal_label}</strong> website. All fields match
              the vacancy creation studio.
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="px-5 md:px-7 pt-3 flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("structured")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === "structured"
                  ? "bg-[#72d0ed]/15 text-[#72d0ed] border border-[#72d0ed]/30"
                  : "text-[#859491] hover:text-white hover:bg-white/5"
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Structured Fields (All Sections)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("raw")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === "raw"
                  ? "bg-[#72d0ed]/15 text-[#72d0ed] border border-[#72d0ed]/30"
                  : "text-[#859491] hover:text-white hover:bg-white/5"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              Raw Markdown Mode
            </button>
          </div>
          <span className="hidden sm:inline-block text-[11px] text-[#728696]">
            {job.portal_label} Target
          </span>
        </div>

        {/* Form Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 md:px-7 py-5 space-y-6">
          {/* Error / Success Banners */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          <form id="edit-job-form" onSubmit={handleSave} className="space-y-6">
            {/* Section 1: Core Role Details */}
            <div className="rounded-2xl border border-white/5 bg-[#0c1219]/60 p-4 md:p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-xs font-bold uppercase tracking-wider text-[#9bb0bf]">
                <BriefcaseBusiness className="h-4 w-4 text-[#72d0ed]" />
                Role & Organization
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9bb0bf] mb-1.5">
                    Job Title <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="h-10 rounded-xl border-white/10 bg-[#10161c] text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9bb0bf] mb-1.5">
                    Department
                  </label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Engineering, Sales, Logistics"
                    className="h-10 rounded-xl border-white/10 bg-[#10161c] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9bb0bf] mb-1.5">
                    Location (City / Country)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-[#728696]" />
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Amsterdam, Netherlands"
                      className="h-10 pl-9 rounded-xl border-white/10 bg-[#10161c] text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9bb0bf] mb-1.5">
                    Publication Status
                  </label>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-10 rounded-xl border-white/10 bg-[#10161c] text-white"
                  >
                    <option value="published">Published (Live on Website)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="closed">Closed / Archived</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 2: Work Model, Contract & Level */}
            <div className="rounded-2xl border border-white/5 bg-[#0c1219]/60 p-4 md:p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-xs font-bold uppercase tracking-wider text-[#9bb0bf]">
                <Layers className="h-4 w-4 text-[#72d0ed]" />
                Employment & Work Conditions
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9bb0bf] mb-1.5">
                    Employment Type
                  </label>
                  <Select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="h-10 rounded-xl border-white/10 bg-[#10161c] text-white"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Internship">Internship</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9bb0bf] mb-1.5">
                    Work Model
                  </label>
                  <Select
                    value={workModel}
                    onChange={(e) => setWorkModel(e.target.value)}
                    className="h-10 rounded-xl border-white/10 bg-[#10161c] text-white"
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9bb0bf] mb-1.5">
                    Experience Level
                  </label>
                  <Select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="h-10 rounded-xl border-white/10 bg-[#10161c] text-white"
                  >
                    <option value="ENTRY">Entry-level (0-2 yrs)</option>
                    <option value="MID">Mid-level (2-5 yrs)</option>
                    <option value="SENIOR">Senior (5+ yrs)</option>
                    <option value="LEAD">Lead / Manager</option>
                    <option value="EXECUTIVE">Executive / Director</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9bb0bf] mb-1.5">
                    Hours / Week
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-[#728696]" />
                    <Input
                      type="number"
                      value={hoursPerWeek}
                      onChange={(e) => setHoursPerWeek(e.target.value)}
                      placeholder="40"
                      className="h-10 pl-9 rounded-xl border-white/10 bg-[#10161c] text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Content Body */}
            {activeTab === "structured" ? (
              <div className="space-y-4">
                {/* 1. About the Role */}
                <div className="rounded-2xl border border-white/5 bg-[#0c1219]/60 p-4 md:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#9bb0bf] flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-[#72d0ed]" />
                      About the Role / Role Overview
                    </label>
                    <span className="text-[11px] text-[#728696]">Introduction & context</span>
                  </div>
                  <Textarea
                    value={aboutRole}
                    onChange={(e) => setAboutRole(e.target.value)}
                    placeholder="Provide a clear, engaging overview of the position, mission, and team context..."
                    rows={4}
                    className="rounded-xl border-white/10 bg-[#10161c] text-white text-xs leading-relaxed"
                  />
                </div>

                {/* 2. Key Responsibilities */}
                <div className="rounded-2xl border border-white/5 bg-[#0c1219]/60 p-4 md:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#9bb0bf] flex items-center gap-1.5">
                      <ListChecks className="h-4 w-4 text-[#72d0ed]" />
                      Key Responsibilities (What You'll Do)
                    </label>
                    <span className="text-[11px] text-[#728696]">One responsibility per line</span>
                  </div>
                  <Textarea
                    value={responsibilities}
                    onChange={(e) => setResponsibilities(e.target.value)}
                    placeholder="• Oversee warehouse daily operations and workflows&#10;• Manage inventory tracking and logistics accuracy&#10;• Supervise and coach team members..."
                    rows={5}
                    className="rounded-xl border-white/10 bg-[#10161c] text-white text-xs leading-relaxed"
                  />
                </div>

                {/* 3. Requirements & Qualifications */}
                <div className="rounded-2xl border border-white/5 bg-[#0c1219]/60 p-4 md:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#9bb0bf] flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-[#72d0ed]" />
                      Requirements & Qualifications (What You'll Bring)
                    </label>
                    <span className="text-[11px] text-[#728696]">One requirement per line</span>
                  </div>
                  <Textarea
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    placeholder="• 3+ years experience in warehouse operations or logistics&#10;• Strong leadership and organizational skills&#10;• Fluent in English (Dutch is a plus)..."
                    rows={5}
                    className="rounded-xl border-white/10 bg-[#10161c] text-white text-xs leading-relaxed"
                  />
                </div>

                {/* 4. What We Offer / Perks */}
                <div className="rounded-2xl border border-white/5 bg-[#0c1219]/60 p-4 md:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#9bb0bf] flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#72d0ed]" />
                      What We Offer (Perks & Benefits)
                    </label>
                    <span className="text-[11px] text-[#728696]">One perk per line</span>
                  </div>
                  <Textarea
                    value={offerInformation}
                    onChange={(e) => setOfferInformation(e.target.value)}
                    placeholder="• Competitive salary package&#10;• 25 paid vacation days&#10;• Training and certification support&#10;• Travel reimbursement..."
                    rows={4}
                    className="rounded-xl border-white/10 bg-[#10161c] text-white text-xs leading-relaxed"
                  />
                </div>

                {/* 5. Additional Information */}
                <div className="rounded-2xl border border-white/5 bg-[#0c1219]/60 p-4 md:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#9bb0bf] flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-[#72d0ed]" />
                      Additional Information (Optional)
                    </label>
                    <span className="text-[11px] text-[#728696]">Extra notes or shift schedule</span>
                  </div>
                  <Textarea
                    value={additionalInformation}
                    onChange={(e) => setAdditionalInformation(e.target.value)}
                    placeholder="Any specific onboarding notes, shift requirements, or program details..."
                    rows={3}
                    className="rounded-xl border-white/10 bg-[#10161c] text-white text-xs leading-relaxed"
                  />
                </div>
              </div>
            ) : (
              /* Raw Markdown View */
              <div className="rounded-2xl border border-white/5 bg-[#0c1219]/60 p-4 md:p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#9bb0bf]">
                    Full Markdown Description
                  </label>
                  <span className="text-[11px] text-[#728696]">
                    Direct markdown editing mode
                  </span>
                </div>
                <Textarea
                  value={rawDescription}
                  onChange={(e) => setRawDescription(e.target.value)}
                  placeholder="Enter or paste full markdown content with ## headings and bullets..."
                  rows={14}
                  className="rounded-xl border-white/10 bg-[#10161c] text-white font-mono text-xs leading-relaxed"
                />
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 p-4 md:px-7 bg-[#0f141c]">
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
            form="edit-job-form"
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
      </div>
    </div>
  );
}
