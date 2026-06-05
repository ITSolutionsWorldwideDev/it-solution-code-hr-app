"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Sparkles } from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type { DepartmentOption, JobDescriptionGenerateResponse } from "@/lib/recruitment-types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type GenerateState = "idle" | "generating" | "generated" | "error";
type SubmitState = "idle" | "submitting" | "submitted" | "error";
type HiringRequestCreateResponse = {
  id: number;
};

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

export function HiringRequestForm() {
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [budget, setBudget] = useState("");
  const [requirements, setRequirements] = useState("");
  const [description, setDescription] = useState("");
  const [generatedSkills, setGeneratedSkills] = useState<string[]>([]);
  const [generateState, setGenerateState] = useState<GenerateState>("idle");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

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

  const selectedDepartment = useMemo(
    () => departments.find((department) => String(department.id) === departmentId),
    [departmentId, departments]
  );

  const handleGenerate = async () => {
    setGenerateState("generating");
    setErrorMessage(null);

    try {
      const response = await apiRequest<JobDescriptionGenerateResponse>({
        path: "/hiring-requests/generate-job-description",
        method: "POST",
        body: JSON.stringify({
          job_title: jobTitle,
          department: selectedDepartment?.name ?? "General",
          budget: budget || null,
          requirements,
        }),
      });

      setDescription(response.generated_job_description);
      setGeneratedSkills(response.generated_required_skills);
      setGenerateState("generated");
    } catch (error) {
      setGenerateState("error");
      setErrorMessage(error instanceof Error ? error.message : "Job description generation failed.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("submitting");
    setErrorMessage(null);

    try {
      const payload = {
        title: jobTitle,
        description,
        required_skills: generatedSkills,
        experience_level: null,
        headcount: 1,
        department_id: Number(departmentId),
        ai_summary: null,
        match_score: null,
        parsed_data: {
          budget,
          generated_required_skills: generatedSkills,
          generation_state: generateState,
        },
      };

      const hiringRequest = await apiRequest<HiringRequestCreateResponse>({
        path: "/hiring-requests/",
        method: "POST",
        body: JSON.stringify(payload),
      });

      await apiRequest({
        path: "/vacancies/",
        method: "POST",
        body: JSON.stringify({
          title: jobTitle,
          description,
          required_skills: generatedSkills,
          experience_level: null,
          status: "open",
          department_id: Number(departmentId),
          hiring_request_id: hiringRequest.id,
          ai_summary: null,
          match_score: null,
          parsed_data: {
            budget,
            location: "Location not set",
            employment_type: "Full-time",
            generated_required_skills: generatedSkills,
            generation_state: generateState,
          },
        }),
      });

      setSubmitState("submitted");
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Hiring request submission failed."
      );
    }
  };

  return (
    <div className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,17,38,0.98)_0%,rgba(16,24,47,0.94)_100%)] p-6 shadow-[0_20px_40px_rgba(0,0,0,0.26)]">
      <div className="flex flex-col gap-2">
        <h2 className="text-[1.4rem] font-semibold text-white">
          Create Hiring Request
        </h2>
        <p className="text-sm text-[#95a2c7]">
          Generate an editable AI draft, then submit the final hiring request.
        </p>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <FormField label="Job title">
          <Input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="Senior Backend Engineer"
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
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="EUR 75,000"
            />
          </FormField>
        </div>

        <FormField
          label="Requirements"
          hint="List the skills, experience, and role expectations for this request."
        >
          <Textarea
            value={requirements}
            onChange={(event) => setRequirements(event.target.value)}
            placeholder="Python, FastAPI, PostgreSQL, API design, and cloud deployment experience."
          />
        </FormField>

        <FormField
          label="Job description"
          hint="The AI draft stays fully editable before submission."
        >
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Generate a job description with AI, then edit it here."
            className="min-h-[180px]"
          />
        </FormField>

        {generatedSkills.length > 0 ? (
          <div className="rounded-[22px] border border-white/8 bg-[#111932] px-4 py-4">
            <p className="text-sm font-semibold text-white">AI-extracted required skills</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {generatedSkills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-white/8 bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-[#9fdcf1]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-[18px] border border-[#7c3945]/70 bg-[#38161f] px-4 py-3 text-sm text-[#efb7bf]">
            {errorMessage}
          </div>
        ) : null}

        {submitState === "submitted" ? (
          <div className="rounded-[18px] border border-[#29473a]/60 bg-[rgba(41,71,58,0.18)] px-4 py-3 text-sm text-[#b7e7c7]">
            Hiring request submitted and vacancy created successfully.{" "}
            <Link href="/vacancies" className="font-semibold text-white underline-offset-4 hover:underline">
              Open vacancies
            </Link>
            .
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            icon={generateState === "generating" ? LoaderCircle : Sparkles}
            onClick={handleGenerate}
            disabled={!jobTitle || !requirements || !departmentId || generateState === "generating"}
            className={generateState === "generating" ? "opacity-80" : ""}
          >
            {generateState === "generating" ? "Generating..." : "Generate Job Description (AI)"}
          </Button>
          <Button
            type="submit"
            disabled={!jobTitle || !departmentId || !description || submitState === "submitting"}
            className={submitState === "submitting" ? "opacity-80" : ""}
          >
            {submitState === "submitting" ? "Submitting..." : "Submit Hiring Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
