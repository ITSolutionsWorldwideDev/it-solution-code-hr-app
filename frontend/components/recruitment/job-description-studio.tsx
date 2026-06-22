"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bold,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eraser,
  FileText,
  Italic,
  Link2,
  List,
  LoaderCircle,
  MapPin,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type { DepartmentOption, JobDescriptionGenerateResponse } from "@/lib/recruitment-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type GenerateState = "idle" | "generating" | "generated" | "error";
type ApprovalState = "idle" | "submitting" | "approved" | "error";
type HiringRequestApiRecord = {
  id: number;
  created_by_id: number;
};
const JOB_DESCRIPTION_DRAFT_KEY = "job-description-studio-draft";

const fallbackDepartments: DepartmentOption[] = [
  { id: 1, name: "Human Resources (HR)" },
  { id: 2, name: "Information Technology (IT) & Software Development" },
  { id: 3, name: "Engineering" },
  { id: 4, name: "Supply Chain & Procurement" },
  { id: 5, name: "Marketing & Digital Marketing" },
  { id: 6, name: "Sales & Business Development" },
  { id: 7, name: "Finance & Accounting" },
  { id: 8, name: "Administration & Operations" },
  { id: 9, name: "Project Management" },
  { id: 10, name: "Customer Support" },
];

const defaultPerksPrompt =
  "Holiday allowance, pension plan, paid time off, travel reimbursement, learning budget, home office support, and performance bonus where relevant.";

type StudioFieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

function StudioField({ label, hint, children }: StudioFieldProps) {
  return (
    <label className="block space-y-3">
      <span className="block text-[0.8rem] font-semibold uppercase tracking-[0.28em] text-[#9bb0bf]">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-sm leading-6 text-[#728696]">{hint}</span> : null}
    </label>
  );
}

export function JobDescriptionStudio() {
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [workHours, setWorkHours] = useState("");
  const [workModel, setWorkModel] = useState("Hybrid");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [perks, setPerks] = useState(defaultPerksPrompt);
  const [requirements, setRequirements] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [generatedSkills, setGeneratedSkills] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [generateState, setGenerateState] = useState<GenerateState>("idle");
  const [approvalState, setApprovalState] = useState<ApprovalState>("idle");
  const [generateErrorMessage, setGenerateErrorMessage] = useState<string | null>(null);
  const [approvalErrorMessage, setApprovalErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await apiRequest<DepartmentOption[]>({ path: "/departments/" });
        setDepartments(response.length > 0 ? response : fallbackDepartments);
      } catch {
        setDepartments(fallbackDepartments);
      }
    };

    void loadDepartments();
  }, []);

  useEffect(() => {
    const storedDraft = window.localStorage.getItem(JOB_DESCRIPTION_DRAFT_KEY);
    if (!storedDraft) {
      return;
    }

    try {
      const draft = JSON.parse(storedDraft) as {
        jobTitle?: string;
        departmentId?: string;
        maxBudget?: string;
        startDate?: string;
        employmentType?: string;
        workHours?: string;
        workModel?: string;
        city?: string;
        country?: string;
        yearsExperience?: string;
        perks?: string;
        requirements?: string;
        generatedDescription?: string;
        generatedSkills?: string[];
        summary?: string | null;
      };

      setJobTitle(draft.jobTitle ?? "");
      setDepartmentId(draft.departmentId ?? "");
      setMaxBudget(draft.maxBudget ?? "");
      setStartDate(draft.startDate ?? "");
      setEmploymentType(draft.employmentType ?? "Full-time");
      setWorkHours(draft.workHours ?? "");
      setWorkModel(draft.workModel ?? "Hybrid");
      setCity(draft.city ?? "");
      setCountry(draft.country ?? "");
      setYearsExperience(draft.yearsExperience ?? "");
      setPerks(draft.perks ?? defaultPerksPrompt);
      setRequirements(draft.requirements ?? "");
      setGeneratedDescription(draft.generatedDescription ?? "");
      setGeneratedSkills(draft.generatedSkills ?? []);
      setSummary(draft.summary ?? null);
      if (draft.generatedDescription) {
        setGenerateState("generated");
      }
    } catch {
      window.localStorage.removeItem(JOB_DESCRIPTION_DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    window.localStorage.setItem(
      JOB_DESCRIPTION_DRAFT_KEY,
      JSON.stringify({
        jobTitle,
        departmentId,
        maxBudget,
        startDate,
        employmentType,
        workHours,
        workModel,
        city,
        country,
        yearsExperience,
        perks,
        requirements,
        generatedDescription,
        generatedSkills,
        summary,
      })
    );
  }, [
    city,
    country,
    departmentId,
    draftReady,
    employmentType,
    generatedDescription,
    generatedSkills,
    jobTitle,
    maxBudget,
    perks,
    requirements,
    startDate,
    summary,
    workHours,
    workModel,
    yearsExperience,
  ]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
      setApprovalState("idle");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  const selectedDepartment = useMemo(
    () => departments.find((department) => String(department.id) === departmentId),
    [departmentId, departments]
  );

  const outputWordCount = useMemo(() => {
    return generatedDescription
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [generatedDescription]);

  const generationInputs = useMemo(
    () => [
      { label: "Role", value: jobTitle || "Not set" },
      { label: "Department", value: selectedDepartment?.name || "Not set" },
      { label: "Location", value: [city, country].filter(Boolean).join(", ") || "Not set" },
      { label: "Work setup", value: workModel || "Not set" },
      { label: "Employment type", value: employmentType || "Not set" },
      { label: "Experience", value: yearsExperience || "Not set" },
      { label: "Budget", value: maxBudget || "AI suggested if empty" },
      {
        label: "Requirements basis",
        value:
          requirements.trim() ||
          "No detailed requirements added. AI will infer a baseline draft from the role and department.",
      },
    ],
    [city, country, employmentType, jobTitle, maxBudget, requirements, selectedDepartment?.name, workModel, yearsExperience],
  );

  const handleGenerate = async () => {
    setGenerateState("generating");
    setApprovalState("idle");
    setGenerateErrorMessage(null);
    setApprovalErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<JobDescriptionGenerateResponse>({
        path: "/hiring-requests/generate-job-description",
        method: "POST",
        body: JSON.stringify({
          job_title: jobTitle,
          department: selectedDepartment?.name ?? "General",
          budget: maxBudget || null,
          start_date: startDate || null,
          employment_type: employmentType || null,
          work_hours: workHours || null,
          work_model: workModel || null,
          city: city || null,
          country: country || null,
          years_experience: yearsExperience || null,
          perks: perks || null,
          requirements,
        }),
      });

      setGeneratedDescription(response.generated_job_description);
      setGeneratedSkills(response.generated_required_skills);
      setSummary(response.summary ?? null);
      if (!maxBudget && response.suggested_max_budget) {
        setMaxBudget(response.suggested_max_budget);
      }
      setGenerateState("generated");
    } catch (error) {
      setGenerateState("error");
      setGenerateErrorMessage(
        error instanceof Error ? error.message : "Job description generation failed."
      );
    }
  };

  const handleApprove = async () => {
    setApprovalState("submitting");
    setApprovalErrorMessage(null);
    setSuccessMessage(null);

    try {
      const hiringRequest = await apiRequest<HiringRequestApiRecord>({
        path: "/hiring-requests/",
        method: "POST",
        body: JSON.stringify({
          title: jobTitle,
          description: generatedDescription,
          required_skills: generatedSkills,
          experience_level: yearsExperience || null,
          headcount: 1,
          department_id: Number(departmentId),
          ai_summary: summary,
          match_score: null,
          parsed_data: {
            max_budget: maxBudget,
            budget: maxBudget,
            start_date: startDate || null,
            city: city || null,
            country: country || null,
            location:
              [city, country].filter((value) => value && value.trim()).join(", ") || "Location not set",
            employment_type: employmentType || "Full-time",
            work_hours: workHours || null,
            work_model: workModel || null,
            years_experience: yearsExperience || null,
            perks,
            generated_required_skills: generatedSkills,
            requirements,
            source: "job-description-studio",
          },
        }),
      });

      await apiRequest({
        path: `/hiring-requests/${hiringRequest.id}/approve`,
        method: "POST",
        body: JSON.stringify({
          reviewed_by_id: hiringRequest.created_by_id,
        }),
      });

      setApprovalState("approved");
      setSuccessMessage("Approved successfully. The new role has been sent to Vacancies.");
    } catch (error) {
      setApprovalState("error");
      setApprovalErrorMessage(error instanceof Error ? error.message : "Approval failed.");
    }
  };

  const handleClearDraft = () => {
    setJobTitle("");
    setDepartmentId("");
    setMaxBudget("");
    setStartDate("");
    setEmploymentType("Full-time");
    setWorkHours("");
    setWorkModel("Hybrid");
    setCity("");
    setCountry("");
    setYearsExperience("");
    setPerks(defaultPerksPrompt);
    setRequirements("");
    setGeneratedDescription("");
    setGeneratedSkills([]);
    setSummary(null);
    setGenerateState("idle");
    setApprovalState("idle");
    setGenerateErrorMessage(null);
    setApprovalErrorMessage(null);
    setSuccessMessage(null);
    window.localStorage.removeItem(JOB_DESCRIPTION_DRAFT_KEY);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.02fr_1fr]">
      <section className="overflow-hidden rounded-[26px] border border-[#1e2d35] bg-[#0d1012] shadow-[0_28px_60px_rgba(0,0,0,0.34)]">
        <div className="border-b border-[#18252c] bg-[linear-gradient(180deg,rgba(16,23,27,0.95)_0%,rgba(13,16,18,0.96)_100%)] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#124854] bg-[rgba(18,212,233,0.1)] shadow-[0_0_24px_rgba(18,212,233,0.14)]">
                  <WandSparkles className="h-5 w-5 text-[#19def0]" />
                </div>
                <div>
                  <h2 className="text-[1.15rem] font-semibold text-white sm:text-[1.35rem]">
                    AI Job Description Input
                  </h2>
                  <p className="text-sm text-[#87a0b1]">Turn a short role brief into an HR-ready vacancy draft.</p>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#98afbf]">
                Describe as much or as little as you want. AI can still generate a draft, and if salary is empty it will suggest one based on the selected country.
              </p>
            </div>

            <div className="inline-flex items-center rounded-[8px] border border-[#1b808e] bg-[rgba(8,39,44,0.9)] px-4 py-2 text-[0.83rem] font-semibold uppercase tracking-[0.24em] text-[#1dd8ea]">
              Step 01
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[18px] border border-[#17252c] bg-[#101416] px-4 py-3">
              <div className="flex items-center gap-2 text-[#19def0]">
                <BriefcaseBusiness className="h-4 w-4" />
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8ca2b2]">
                  Role
                </span>
              </div>
              <p className="mt-3 truncate text-sm font-medium text-white">
                {jobTitle || "Not set yet"}
              </p>
            </div>
            <div className="rounded-[18px] border border-[#17252c] bg-[#101416] px-4 py-3">
              <div className="flex items-center gap-2 text-[#19def0]">
                <Building2 className="h-4 w-4" />
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8ca2b2]">
                  Department
                </span>
              </div>
              <p className="mt-3 truncate text-sm font-medium text-white">
                {selectedDepartment?.name || "Select department"}
              </p>
            </div>
            <div className="rounded-[18px] border border-[#17252c] bg-[#101416] px-4 py-3">
              <div className="flex items-center gap-2 text-[#19def0]">
                <MapPin className="h-4 w-4" />
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8ca2b2]">
                  Location
                </span>
              </div>
              <p className="mt-3 truncate text-sm font-medium text-white">
                {[city, country].filter(Boolean).join(", ") || "Location not set"}
              </p>
            </div>
            <div className="rounded-[18px] border border-[#17252c] bg-[#101416] px-4 py-3">
              <div className="flex items-center gap-2 text-[#19def0]">
                <Clock3 className="h-4 w-4" />
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#8ca2b2]">
                  Setup
                </span>
              </div>
              <p className="mt-3 truncate text-sm font-medium text-white">
                {workModel || "Hybrid"}
              </p>
            </div>
          </div>

          <StudioField label="Job title">
            <Input
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Data Analyst"
              className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] text-[1.05rem] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
            />
          </StudioField>

          <div className="grid gap-5 md:grid-cols-2">
            <StudioField label="Department">
              <Select
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              >
                <option value="" disabled>
                  Select department
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </StudioField>

            <StudioField label="Max budget">
              <Input
                value={maxBudget}
                onChange={(event) => setMaxBudget(event.target.value)}
                placeholder="EUR 55,000"
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              />
            </StudioField>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <StudioField label="Start date">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              />
            </StudioField>

            <StudioField label="Years of experience">
              <Input
                value={yearsExperience}
                onChange={(event) => setYearsExperience(event.target.value)}
                placeholder="3+ years"
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              />
            </StudioField>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <StudioField label="Employment type">
              <Select
                value={employmentType}
                onChange={(event) => setEmploymentType(event.target.value)}
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
              </Select>
            </StudioField>

            <StudioField label="Work hours">
              <Input
                value={workHours}
                onChange={(event) => setWorkHours(event.target.value)}
                placeholder="40 hours per week"
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              />
            </StudioField>

            <StudioField label="Work setup">
              <Select
                value={workModel}
                onChange={(event) => setWorkModel(event.target.value)}
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              >
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
              </Select>
            </StudioField>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <StudioField label="City">
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Amsterdam"
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              />
            </StudioField>

            <StudioField label="Country">
              <Input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="Netherlands"
                className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
              />
            </StudioField>
          </div>

          <StudioField
            label="What are you looking for?"
            hint="List the responsibilities, experience, tools, skills, and expectations for the role."
          >
            <Textarea
              value={requirements}
              onChange={(event) => setRequirements(event.target.value)}
              placeholder="Power BI skills, Excel skills, data storytelling, reporting, dashboards, stakeholder communication."
              className="min-h-[150px] rounded-[14px] border-[#1c262c] bg-[#101214] leading-8 focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
            />
          </StudioField>

          <StudioField
            label="Perks and benefits prompts"
            hint="These default benefits are sent to AI and can be adjusted per vacancy."
          >
            <Textarea
              value={perks}
              onChange={(event) => setPerks(event.target.value)}
              placeholder={defaultPerksPrompt}
              className="min-h-[120px] rounded-[14px] border-[#1c262c] bg-[#101214] leading-8 focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
            />
          </StudioField>

          {generateErrorMessage ? (
            <div className="rounded-[16px] border border-[#6d2f37] bg-[rgba(109,47,55,0.24)] px-4 py-3 text-sm text-[#f4b2bd]">
              {generateErrorMessage}
            </div>
          ) : null}

          {generateState === "generating" ? (
            <div className="rounded-[16px] border border-[#154b55] bg-[rgba(12,43,48,0.55)] px-4 py-3">
              <div className="flex items-center gap-3 text-sm text-[#d6e3ee]">
                <LoaderCircle className="h-4 w-4 animate-spin text-[#19def0]" />
                <span>AI is creating a job description, please wait.</span>
              </div>
            </div>
          ) : null}

          <div className="pt-2">
            <Button
              type="button"
              icon={generateState === "generating" ? LoaderCircle : Sparkles}
              onClick={handleGenerate}
              disabled={generateState === "generating"}
              className={`h-16 w-full justify-center rounded-[14px] border border-[#1fb9c9] bg-[#18d8ea] text-[1.04rem] font-semibold text-[#041317] shadow-[0_18px_34px_rgba(24,216,234,0.18)] hover:brightness-105 ${generateState === "generating" ? "opacity-80" : ""}`}
            >
              {generateState === "generating" ? "Generating..." : "Generate Job Description (AI)"}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[26px] border border-[#1e2d35] bg-[#0d1012] shadow-[0_28px_60px_rgba(0,0,0,0.34)]">
        <div className="border-b border-[#18252c] bg-[linear-gradient(180deg,rgba(16,23,27,0.95)_0%,rgba(13,16,18,0.96)_100%)] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#124854] bg-[rgba(18,212,233,0.1)] shadow-[0_0_24px_rgba(18,212,233,0.14)]">
                  <FileText className="h-5 w-5 text-[#19def0]" />
                </div>
                <div>
                  <h2 className="text-[1.15rem] font-semibold text-white sm:text-[1.35rem]">
                    AI Job Description Output
                  </h2>
                  <p className="text-sm text-[#87a0b1]">Edit the generated vacancy directly in the text box below.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#a4b7c5]">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#1b252b] bg-[#111517]">
                <Bold className="h-4 w-4" />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#1b252b] bg-[#111517]">
                <Italic className="h-4 w-4" />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#1b252b] bg-[#111517]">
                <List className="h-4 w-4" />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#1b252b] bg-[#111517]">
                <Link2 className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="rounded-[22px] border border-[#18252c] bg-[#111517] p-4">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#1a242a] px-2 pb-4 text-[#a9bac6]">
              <Bold className="h-4 w-4" />
              <Italic className="h-4 w-4" />
              <List className="h-4 w-4" />
              <span className="h-5 w-px bg-[#223038]" />
              <Link2 className="h-4 w-4" />
            </div>

          {generateState === "generating" ? (
            <div className="rounded-[18px] p-6">
              <div className="flex min-h-[620px] flex-col items-center justify-center gap-5 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#154b55] bg-[rgba(12,43,48,0.55)]">
                  <LoaderCircle className="h-8 w-8 animate-spin text-[#19def0]" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-white">
                    AI is creating a job description
                  </p>
                  <p className="text-sm text-[#8fa3b5]">
                    Please wait while we generate a polished draft for this role.
                  </p>
                </div>
              </div>
            </div>
          ) : generatedDescription ? (
            <div className="space-y-6">
              <div className="rounded-[16px] border border-[#1a252c] bg-[#0d1113] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ea2b3]">
                  How this draft was generated
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {generationInputs.map((item) => (
                    <div key={item.label} className="rounded-[12px] border border-[#172126] bg-[#0a0e10] px-3 py-3">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#7690a0]">
                        {item.label}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#d9e5ee]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {summary ? (
                <div className="rounded-[16px] border border-[#1a252c] bg-[#0d1113] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ea2b3]">
                    Summary
                  </p>
                  <p className="mt-2 text-[1rem] leading-7 text-[#d9e5ee]">{summary}</p>
                </div>
              ) : null}

              <div>
                <Textarea
                  value={generatedDescription}
                  onChange={(event) => setGeneratedDescription(event.target.value)}
                  placeholder="Your generated job description will appear here and can be edited before approval."
                  className="min-h-[540px] rounded-[16px] border-[#1a252c] bg-[#07090a] px-5 py-5 text-[1rem] leading-8 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                />
              </div>

              {generatedSkills.length > 0 ? (
                <div className="rounded-[16px] border border-[#1a252c] bg-[#0d1113] px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ea2b3]">
                    AI-extracted skills
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {generatedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-[#18424a] bg-[rgba(18,212,233,0.08)] px-3 py-1.5 text-sm font-medium text-[#9fefff]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-[18px] border border-[#1f5c48] bg-[rgba(24,74,57,0.26)] px-5 py-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#b8e2c5]" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[#d8f1e0]">{successMessage}</p>
                      <Link
                        href="/vacancies"
                        className="text-sm font-semibold text-white underline decoration-white/35 underline-offset-4"
                      >
                        Open Vacancies
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}

              {approvalErrorMessage ? (
                <div className="rounded-[18px] border border-[#6d2f37] bg-[rgba(109,47,55,0.24)] px-5 py-4 text-sm text-[#f0b6bf]">
                  {approvalErrorMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleApprove}
                  disabled={
                    !jobTitle ||
                    !departmentId ||
                    !generatedDescription ||
                    approvalState === "submitting" ||
                    approvalState === "approved"
                  }
                  className={approvalState === "submitting" ? "opacity-80" : ""}
                >
                  {approvalState === "submitting"
                    ? "Approving..."
                    : approvalState === "approved"
                      ? "Approved"
                      : "Approve And Send To Vacancies"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={Eraser}
                  onClick={handleClearDraft}
                  className="rounded-[14px] border-[#28343a] bg-[#101416] px-6 py-4"
                >
                  Clear Draft
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[620px] items-center justify-center rounded-[18px] bg-[#07090a] px-8 text-center">
              <div className="max-w-sm space-y-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#15343c] bg-[rgba(18,212,233,0.08)]">
                  <FileText className="h-7 w-7 text-[#19def0]" />
                </div>
                <p className="text-[1.05rem] leading-8 text-[#6e808d]">
                  The generated job description will appear here as one editable vacancy text.
                </p>
              </div>
            </div>
          )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-1 text-sm text-[#6f8492]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>Draft ready</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>{outputWordCount} words</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 text-[#84e8a5]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1dd75f]" />
              <span>Local draft saved</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
