"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eraser, LoaderCircle, Sparkles } from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type { DepartmentOption, JobDescriptionGenerateResponse } from "@/lib/recruitment-types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
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
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.4rem] font-semibold text-white">
            AI Job Description Input
          </h2>
          <p className="text-sm text-[#95a8b8]">
            Describe as much or as little as you want. AI can still generate a draft, and if salary is empty it will suggest one based on the selected country.
          </p>
        </div>

        <div className="mt-6 space-y-5">
          <FormField label="Job title">
            <Input
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Data Analyst"
            />
          </FormField>

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Department">
              <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="" disabled>
                  Select department
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Max budget">
              <Input
                value={maxBudget}
                onChange={(event) => setMaxBudget(event.target.value)}
                placeholder="EUR 55,000"
              />
            </FormField>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Start date">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </FormField>

            <FormField label="Years of experience">
              <Input
                value={yearsExperience}
                onChange={(event) => setYearsExperience(event.target.value)}
                placeholder="3+ years"
              />
            </FormField>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <FormField label="Employment type">
              <Select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
              </Select>
            </FormField>

            <FormField label="Work hours">
              <Input
                value={workHours}
                onChange={(event) => setWorkHours(event.target.value)}
                placeholder="40 hours per week"
              />
            </FormField>

            <FormField label="Work setup">
              <Select value={workModel} onChange={(event) => setWorkModel(event.target.value)}>
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
              </Select>
            </FormField>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="City">
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Amsterdam"
              />
            </FormField>

            <FormField label="Country">
              <Input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="Netherlands"
              />
            </FormField>
          </div>

          <FormField
            label="What are you looking for?"
            hint="List the responsibilities, experience, tools, skills, and expectations for the role."
          >
            <Textarea
              value={requirements}
              onChange={(event) => setRequirements(event.target.value)}
              placeholder="Power BI skills, Excel skills, data storytelling, reporting, dashboards, stakeholder communication."
              className="min-h-[240px]"
            />
          </FormField>

          <FormField
            label="Perks and benefits prompts"
            hint="These default benefits are sent to AI and can be adjusted per vacancy."
          >
            <Textarea
              value={perks}
              onChange={(event) => setPerks(event.target.value)}
              placeholder={defaultPerksPrompt}
              className="min-h-[120px]"
            />
          </FormField>

          {generateErrorMessage ? (
            <div className="rounded-[18px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-4 py-3 text-sm text-[#f0b6bf]">
              {generateErrorMessage}
            </div>
          ) : null}

          {generateState === "generating" ? (
            <div className="rounded-[18px] border border-[#6f86a3]/25 bg-[rgba(111,134,163,0.09)] px-4 py-3">
              <div className="flex items-center gap-3 text-sm text-[#d6e3ee]">
                <LoaderCircle className="h-4 w-4 animate-spin text-[#a8c2d9]" />
                <span>AI is creating a job description, please wait.</span>
              </div>
            </div>
          ) : null}

          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              icon={generateState === "generating" ? LoaderCircle : Sparkles}
              onClick={handleGenerate}
              disabled={generateState === "generating"}
              className={generateState === "generating" ? "opacity-80" : ""}
            >
              {generateState === "generating" ? "Generating..." : "Generate Job Description (AI)"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.4rem] font-semibold text-white">
            AI Job Description Output
          </h2>
          <p className="text-sm text-[#95a8b8]">
            Edit the generated vacancy directly in the text box below.
          </p>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/8 bg-white/[0.03] p-6">
          {generateState === "generating" ? (
            <div className="rounded-[18px] border border-white/10 bg-[#171c24] p-6">
              <div className="flex min-h-[520px] flex-col items-center justify-center gap-5 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <LoaderCircle className="h-8 w-8 animate-spin text-[#dce9f3]" />
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
              {summary ? (
                <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-4">
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
                  className="min-h-[520px] border-white/10 bg-[#171c24] text-[1rem] leading-8 text-white"
                />
              </div>

              {generatedSkills.length > 0 ? (
                <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ea2b3]">
                    AI-extracted skills
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {generatedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-white/8 bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-[#9fc6e0]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-[22px] border border-[#325143]/70 bg-[rgba(50,81,67,0.22)] px-5 py-4">
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
                <div className="rounded-[22px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-5 py-4 text-sm text-[#f0b6bf]">
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
                >
                  Clear Draft
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-[18px] border border-white/10 bg-[#171c24] p-4">
              <Textarea
                value=""
                onChange={() => undefined}
                readOnly
                placeholder="The generated job description will appear here as one editable vacancy text."
                className="min-h-[520px] border-0 bg-transparent text-[1rem] leading-8 text-white placeholder:text-[#73879a]"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
