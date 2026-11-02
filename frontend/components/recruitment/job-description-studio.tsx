"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bold,
  BriefcaseBusiness,
  Building,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eraser,
  ExternalLink,
  FileText,
  Globe,
  Italic,
  Layers,
  Link2,
  List,
  LoaderCircle,
  MapPin,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type {
  DepartmentOption,
  JobDescriptionGenerateResponse,
  VacancyApiRecord,
  WebsitePublishApiRecord,
} from "@/lib/recruitment-types";
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
    <label className="block space-y-2.5">
      <span className="block text-[0.8rem] font-semibold uppercase tracking-[0.24em] text-[#9bb0bf]">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-[#728696]">{hint}</span> : null}
    </label>
  );
}

export function JobDescriptionStudio() {
  // Mode selection: "ai" or "manual"
  const [mode, setMode] = useState<"ai" | "manual">("ai");

  // Common departments
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // ----------------------------------------------------
  // AI MODE STATES
  // ----------------------------------------------------
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
  const [draftReady, setDraftReady] = useState(false);

  // ----------------------------------------------------
  // MANUAL MODE STATES (ITWW & ISH Admin style)
  // ----------------------------------------------------
  const [manualTitle, setManualTitle] = useState("");
  const [manualDepartmentId, setManualDepartmentId] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualEmploymentType, setManualEmploymentType] = useState("Full-time");
  const [manualExperienceLevel, setManualExperienceLevel] = useState("Mid-level");
  const [manualWorkModel, setManualWorkModel] = useState("Hybrid");
  const [manualBudget, setManualBudget] = useState("");
  const [manualHoursPerWeek, setManualHoursPerWeek] = useState("40");
  const [manualSkills, setManualSkills] = useState("");
  const [manualPdfUrl, setManualPdfUrl] = useState("");
  const [manualTargetPortal, setManualTargetPortal] = useState("all");
  const [manualPublished, setManualPublished] = useState(true);
  const [manualDescription, setManualDescription] = useState("");
  const [manualCompanyInfo, setManualCompanyInfo] = useState("");
  const [manualAboutRole, setManualAboutRole] = useState("");
  const [manualResponsibilities, setManualResponsibilities] = useState("");
  const [manualRequirements, setManualRequirements] = useState("");
  const [manualNiceToHave, setManualNiceToHave] = useState("");
  const [manualAdditionalInfo, setManualAdditionalInfo] = useState("");
  const [manualContentTab, setManualContentTab] = useState<"structured" | "raw">("structured");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualErrorMessage, setManualErrorMessage] = useState<string | null>(null);
  const [manualSuccessMessage, setManualSuccessMessage] = useState<string | null>(null);
  const [manualCreatedVacancyId, setManualCreatedVacancyId] = useState<number | null>(null);

  // Portal selection prompt modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishModalSource, setPublishModalSource] = useState<"ai" | "manual">("manual");
  const [selectedPortals, setSelectedPortals] = useState<string[]>(["itww", "ish", "dinel"]);
  const [portalPublishing, setPortalPublishing] = useState(false);
  const [portalPublishResult, setPortalPublishResult] = useState<WebsitePublishApiRecord | null>(null);

  // Load departments
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

  // Restore AI draft from localStorage
  useEffect(() => {
    const storedDraft = window.localStorage.getItem(JOB_DESCRIPTION_DRAFT_KEY);
    if (!storedDraft) {
      setDraftReady(true);
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

  // Save AI draft
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

  // Selected department helpers
  const selectedDepartment = useMemo(
    () => departments.find((department) => String(department.id) === departmentId),
    [departmentId, departments]
  );

  const selectedManualDepartment = useMemo(
    () => departments.find((department) => String(department.id) === manualDepartmentId),
    [manualDepartmentId, departments]
  );

  const outputWordCount = useMemo(() => {
    return generatedDescription
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [generatedDescription]);

  const manualWordCount = useMemo(() => {
    return manualDescription
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [manualDescription]);

  const manualParsedSkills = useMemo(() => {
    return manualSkills
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [manualSkills]);

  // Switch to manual mode and optionally pre-fill with filled AI inputs
  const handleSwitchToManual = () => {
    setMode("manual");
    if (!manualTitle && jobTitle) setManualTitle(jobTitle);
    if (!manualDepartmentId && departmentId) setManualDepartmentId(departmentId);
    if (!manualLocation && (city || country)) {
      setManualLocation([city, country].filter(Boolean).join(", "));
    }
    if (!manualEmploymentType && employmentType) setManualEmploymentType(employmentType);
    if (!manualWorkModel && workModel) setManualWorkModel(workModel);
    if (!manualBudget && maxBudget) setManualBudget(maxBudget);
    if (!manualDescription && generatedDescription) setManualDescription(generatedDescription);
    if (!manualSkills && generatedSkills.length > 0) setManualSkills(generatedSkills.join(", "));
  };

  // ----------------------------------------------------
  // AI GENERATOR HANDLERS
  // ----------------------------------------------------
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
              [city, country].filter((value) => value && value.trim()).join(", ") ||
              "Location not set",
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
      setSuccessMessage("Approved successfully. The new role has been published to Vacancies.");
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

  // ----------------------------------------------------
  // MANUAL POSTING HANDLERS (ITWW & ISH Admin style)
  // ----------------------------------------------------
  const composeStructuredJobContent = (
    about: string,
    resps: string,
    reqs: string,
    nice: string,
    extra: string,
    company: string = ""
  ): string => {
    const sections: string[] = [];
    if (company.trim()) {
      sections.push(`## Company Overview\n\n${company.trim()}`);
    }
    if (about.trim()) {
      sections.push(`## About the Role\n\n${about.trim()}`);
    }
    const rLines = resps.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean);
    if (rLines.length) {
      sections.push(`## Key Responsibilities\n\n${rLines.map((r) => `- ${r}`).join("\n")}`);
    }
    const qLines = reqs.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean);
    if (qLines.length) {
      sections.push(`## Requirements\n\n${qLines.map((q) => `- ${q}`).join("\n")}`);
    }
    const nLines = nice.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean);
    if (nLines.length) {
      sections.push(`## What We Offer / Nice to Have\n\n${nLines.map((n) => `- ${n}`).join("\n")}`);
    }
    if (extra.trim()) {
      sections.push(`## Additional Information\n\n${extra.trim()}`);
    }
    return sections.join("\n\n");
  };

  const getEffectiveManualDescription = (): string => {
    if (manualContentTab === "raw" && manualDescription.trim()) {
      return manualDescription.trim();
    }
    const structured = composeStructuredJobContent(
      manualAboutRole,
      manualResponsibilities,
      manualRequirements,
      manualNiceToHave,
      manualAdditionalInfo,
      manualCompanyInfo
    );
    return structured || manualDescription.trim();
  };

  const handleInsertManualTemplate = () => {
    const roleTitle = manualTitle.trim() || "Professional";
    const dept = selectedManualDepartment?.name || "our team";
    const loc = manualLocation.trim() || "Amsterdam, Netherlands";
    const setup = manualWorkModel || "Hybrid";

    const companyText = `Staff Outsourcing & IT Solutions Worldwide is a leading technology and industrial workforce partner, connecting premier European organizations with vetted professionals.`;

    const aboutText = `We are seeking an experienced and dedicated ${roleTitle} to join ${dept} (${setup} in ${loc}). In this role, you will collaborate with cross-functional technical teams, support key company initiatives, and drive reliable delivery across European and international operations.`;

    const respText = `Execute core technical and operational tasks in accordance with international standards
Maintain, troubleshoot, and optimize project systems and business processes
Collaborate closely with internal stakeholders and technical team leads to meet project milestones
Ensure complete documentation, quality assurance, and adherence to safety and compliance standards`;

    const reqText = `Demonstrated practical experience in a similar role with hands-on technical expertise
Strong problem-solving, analytical, and interpersonal skills
Proficiency in professional English communication (spoken and written)
Ability to work independently as well as collaboratively in multi-disciplinary teams`;

    const niceText = `Relevant technical certifications, trade credentials, or specialized training
Previous experience working with European or international clients
Familiarity with modern enterprise tooling, automation, and reporting systems`;

    const extraText = `What We Offer:\n• Competitive compensation package ${manualBudget ? `(${manualBudget})` : ""}\n• Full onboarding support and continuous career progression\n• Comprehensive benefits package and dynamic international environment`;

    setManualCompanyInfo(companyText);
    setManualAboutRole(aboutText);
    setManualResponsibilities(respText);
    setManualRequirements(reqText);
    setManualNiceToHave(niceText);
    setManualAdditionalInfo(extraText);
    setManualHoursPerWeek("40");

    const composed = composeStructuredJobContent(aboutText, respText, reqText, niceText, extraText, companyText);
    setManualDescription(composed);
  };

  const parseStructuredJobDescription = (text: string) => {
    const lines = text.split("\n");
    let currentSection = "";
    let aboutRole = "";
    const responsibilities: string[] = [];
    const requirements: string[] = [];
    const niceToHave: string[] = [];
    const additionalInfo: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Clean heading: strip markdown characters (#, *, _) and trailing colon
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
        currentSection = "nice";
        continue;
      } else if (
        cleanHeading === "additional information" ||
        cleanHeading === "additional info" ||
        cleanHeading === "aanvullende informatie" ||
        cleanHeading === "trainings- en ontwikkelprogramma"
      ) {
        currentSection = "extra";
        continue;
      } else if (
        cleanHeading === "apply here" ||
        cleanHeading.startsWith("apply for") ||
        cleanHeading === "solliciteren" ||
        cleanHeading.startsWith("plak hier") ||
        cleanHeading === "why it solutions worldwide" ||
        cleanHeading === "excellence in execution. consistency in results."
      ) {
        currentSection = "ignore";
        continue;
      }

      if (currentSection === "ignore") {
        continue;
      }

      // Filter out top metadata lines from polluting "About the role"
      const lower = trimmed.toLowerCase();
      if (
        currentSection === "about" &&
        (lower.startsWith("location:") ||
          lower.startsWith("job type:") ||
          lower.startsWith("salary indication:") ||
          lower.startsWith("experience:") ||
          lower.startsWith("start date:") ||
          lower.startsWith("work type:") ||
          lower.startsWith("[plak hier") ||
          lower.includes(" | it solutions worldwide"))
      ) {
        continue;
      }

      const cleanBullet = trimmed.replace(/^[-*•\d+.)]+\s*/, "").trim();
      if (!cleanBullet) continue;

      if (currentSection === "about") {
        aboutRole += (aboutRole ? "\n\n" : "") + trimmed;
      } else if (currentSection === "resp") {
        responsibilities.push(cleanBullet);
      } else if (currentSection === "req") {
        requirements.push(cleanBullet);
      } else if (currentSection === "nice") {
        niceToHave.push(cleanBullet);
      } else if (currentSection === "extra") {
        additionalInfo.push(cleanBullet);
      }
    }

    return {
      aboutRole: aboutRole || text.slice(0, 350),
      responsibilities: responsibilities.length
        ? responsibilities
        : ["Deliver core responsibilities in accordance with professional standards."],
      requirements: requirements.length
        ? requirements
        : ["Relevant experience and qualifications for the role."],
      niceToHave: niceToHave.length
        ? niceToHave
        : ["Competitive salary, growth opportunities, and holiday allowance."],
      additionalInfo: additionalInfo.join("\n"),
    };
  };

  const handleOpenAiPublishModal = () => {
    if (!jobTitle.trim()) {
      setApprovalErrorMessage("Please enter a Job Title.");
      return;
    }
    if (!departmentId) {
      setApprovalErrorMessage("Please select a Department.");
      return;
    }
    if (!generatedDescription.trim()) {
      setApprovalErrorMessage("Please generate or enter a job description draft first.");
      return;
    }

    setApprovalErrorMessage(null);
    setPublishModalSource("ai");
    setSelectedPortals(["itww", "ish", "dinel"]);
    setPublishModalOpen(true);
  };

  const handleOpenPublishModal = () => {
    if (!manualTitle.trim()) {
      setManualErrorMessage("Please enter a Job Title.");
      return;
    }
    if (!manualDepartmentId) {
      setManualErrorMessage("Please select a Department.");
      return;
    }

    const finalDescription = getEffectiveManualDescription();
    if (!finalDescription.trim()) {
      setManualErrorMessage("Please fill in the structured fields or write a job description.");
      return;
    }

    setManualErrorMessage(null);
    setPublishModalSource("manual");

    // Initialize portal choices based on current dropdown
    if (manualTargetPortal === "itww") {
      setSelectedPortals(["itww"]);
    } else if (manualTargetPortal === "ish") {
      setSelectedPortals(["ish"]);
    } else if (manualTargetPortal === "dinel") {
      setSelectedPortals(["dinel"]);
    } else {
      setSelectedPortals(["itww", "ish", "dinel"]);
    }

    setPublishModalOpen(true);
  };

  const togglePortal = (portalKey: string) => {
    setSelectedPortals((prev) =>
      prev.includes(portalKey) ? prev.filter((p) => p !== portalKey) : [...prev, portalKey]
    );
  };

  const executePublishWithPortals = async (chosenPortals: string[]) => {
    const isAi = publishModalSource === "ai";
    if (isAi) {
      setApprovalState("submitting");
      setApprovalErrorMessage(null);
      setSuccessMessage(null);
    } else {
      setManualSubmitting(true);
      setManualErrorMessage(null);
      setManualSuccessMessage(null);
    }
    setPortalPublishing(true);

    const targetPortalStr =
      chosenPortals.length === 3 ? "all" : chosenPortals.length === 0 ? "none" : chosenPortals.join(",");

    try {
      let vacancyId: number;
      let finalTitle: string;
      let finalDescription = "";
      const parsedSec = parseStructuredJobDescription(generatedDescription);
      const locationStr = [city, country].filter(Boolean).join(", ") || "Netherlands";

      if (isAi) {
        finalTitle = jobTitle.trim();
        finalDescription = generatedDescription.trim();
        const resolvedSkills =
          generatedSkills.length > 0 ? generatedSkills : parsedSec.requirements.slice(0, 6);

        const response = await apiRequest<VacancyApiRecord>({
          path: "/vacancies/",
          method: "POST",
          body: JSON.stringify({
            title: finalTitle,
            description: generatedDescription.trim(),
            required_skills: resolvedSkills,
            experience_level: yearsExperience || null,
            status: "open",
            department_id: Number(departmentId),
            ai_summary: summary || generatedDescription.trim().slice(0, 220),
            match_score: null,
            parsed_data: {
              location: locationStr,
              city: city || null,
              country: country || null,
              employment_type: employmentType || "Full-time",
              work_model: workModel || "Hybrid",
              max_budget: maxBudget.trim() || null,
              budget: maxBudget.trim() || null,
              hours_per_week: workHours ? parseInt(workHours) || 40 : 40,
              target_portal: targetPortalStr,
              published: 1,
              company_info:
                "Staff Outsourcing & IT Solutions Worldwide is a leading technology workforce partner connecting premier European organizations with vetted professionals.",
              company_information:
                "Staff Outsourcing & IT Solutions Worldwide is a leading technology workforce partner connecting premier European organizations with vetted professionals.",
              about_role: parsedSec.aboutRole,
              intro_information: parsedSec.aboutRole,
              responsibilities: parsedSec.responsibilities,
              vacancy_information: parsedSec.responsibilities,
              requirements: parsedSec.requirements,
              nice_to_have: parsedSec.niceToHave,
              offer_information: parsedSec.niceToHave,
              additional_info: parsedSec.additionalInfo,
              additional_information: parsedSec.additionalInfo,
              source: "ai-job-description-studio",
            },
          }),
        });

        vacancyId = response.id;
      } else {
        finalTitle = manualTitle.trim();
        finalDescription = getEffectiveManualDescription();
        const skillsArray =
          manualParsedSkills.length > 0 ? manualParsedSkills : ["Problem Solving", "Communication"];

        // 1. Create Vacancy record
        const response = await apiRequest<VacancyApiRecord>({
          path: "/vacancies/",
          method: "POST",
          body: JSON.stringify({
            title: finalTitle,
            description: finalDescription.trim(),
            required_skills: skillsArray,
            experience_level: manualExperienceLevel || null,
            status: "open",
            department_id: Number(manualDepartmentId),
            ai_summary: finalDescription.trim().slice(0, 220),
            match_score: null,
            parsed_data: {
              location: manualLocation.trim() || "Netherlands",
              employment_type: manualEmploymentType || "Full-time",
              work_model: manualWorkModel || "Hybrid",
              max_budget: manualBudget.trim() || null,
              budget: manualBudget.trim() || null,
              hours_per_week: Number(manualHoursPerWeek) || 40,
              pdf_url: manualPdfUrl.trim() || null,
              target_portal: targetPortalStr,
              published: 1,
              company_info: manualCompanyInfo.trim(),
              company_information: manualCompanyInfo.trim(),
              about_role: manualAboutRole.trim(),
              intro_information: manualAboutRole.trim(),
              responsibilities: manualResponsibilities
                .split("\n")
                .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
                .filter(Boolean),
              vacancy_information: manualResponsibilities
                .split("\n")
                .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
                .filter(Boolean),
              requirements: manualRequirements
                .split("\n")
                .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
                .filter(Boolean),
              nice_to_have: manualNiceToHave
                .split("\n")
                .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
                .filter(Boolean),
              offer_information: manualNiceToHave
                .split("\n")
                .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
                .filter(Boolean),
              additional_info: manualAdditionalInfo.trim(),
              additional_information: manualAdditionalInfo.trim(),
              source: "manual-admin-posting",
            },
          }),
        });

        vacancyId = response.id;
        setManualCreatedVacancyId(response.id);
      }

      // 2. Publish to selected career portals immediately if any portal chosen
      let publishSummary = `Vacancy #${vacancyId} created successfully!`;
      if (chosenPortals.length > 0) {
        const pubRes = await apiRequest<WebsitePublishApiRecord>({
          path: "/integrations/website/publish",
          method: "POST",
          body: JSON.stringify({
            vacancy_id: vacancyId,
            target_portal: targetPortalStr,
            portals: chosenPortals,
            title: finalTitle,
            about_role: isAi ? parsedSec.aboutRole : manualAboutRole,
            responsibilities: isAi
              ? parsedSec.responsibilities
              : manualResponsibilities.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean),
            requirements: isAi
              ? parsedSec.requirements
              : manualRequirements.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean),
            nice_to_have: isAi
              ? parsedSec.niceToHave
              : manualNiceToHave.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean),
            additional_info: isAi ? parsedSec.additionalInfo : manualAdditionalInfo,
            location: isAi ? locationStr : manualLocation.trim() || "Amsterdam, Netherlands",
            employment_type: isAi ? (employmentType || "Full-time") : (manualEmploymentType || "Full-time"),
            work_model: isAi ? (workModel || "Hybrid") : (manualWorkModel || "Hybrid"),
            description: isAi ? generatedDescription : finalDescription,
          }),
        });

        setPortalPublishResult(pubRes);

        const publishedTo: string[] = [];
        if (pubRes.itww_job_info_id) publishedTo.push(`ITWW (#${pubRes.itww_job_info_id})`);
        if (pubRes.ish_job_info_id) publishedTo.push(`ISH (#${pubRes.ish_job_info_id})`);
        if (pubRes.dinel_job_info_id)
          publishedTo.push(`Staff Outsourcing (#${pubRes.dinel_job_info_id})`);

        publishSummary = `Vacancy #${vacancyId} ("${finalTitle}") published to: ${
          publishedTo.length > 0 ? publishedTo.join(", ") : pubRes.message
        }! Zero duplicates created.`;

        // Persist portal tracking IDs onto vacancy parsed_data
        try {
          await apiRequest({
            path: `/vacancies/${vacancyId}`,
            method: "PUT",
            body: JSON.stringify({
              parsed_data: {
                ...(isAi ? parsedSec : {}),
                location: isAi ? locationStr : manualLocation.trim() || "Netherlands",
                employment_type: isAi ? (employmentType || "Full-time") : (manualEmploymentType || "Full-time"),
                work_model: isAi ? (workModel || "Hybrid") : (manualWorkModel || "Hybrid"),
                target_portal: targetPortalStr,
                published: 1,
                itww_job_info_id: pubRes.itww_job_info_id,
                ish_job_info_id: pubRes.ish_job_info_id,
                dinel_job_info_id: pubRes.dinel_job_info_id,
              },
            }),
          });
        } catch {
          // ignore tracking update failure
        }
      }

      setPublishModalOpen(false);
      if (isAi) {
        setApprovalState("approved");
        setSuccessMessage(publishSummary);
      } else {
        setManualSuccessMessage(publishSummary);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish job vacancy.";
      if (isAi) {
        setApprovalState("error");
        setApprovalErrorMessage(msg);
      } else {
        setManualErrorMessage(msg);
      }
    } finally {
      setManualSubmitting(false);
      setPortalPublishing(false);
    }
  };

  const handleManualPublish = (asDraft: boolean = false) => {
    if (!manualTitle.trim()) {
      setManualErrorMessage("Please enter a Job Title.");
      return;
    }
    if (!manualDepartmentId) {
      setManualErrorMessage("Please select a Department.");
      return;
    }

    if (asDraft || !manualPublished) {
      void executePublishWithPortals([]);
      return;
    }

    handleOpenPublishModal();
  };

  const handleManualSaveIntake = async () => {
    if (!manualTitle.trim()) {
      setManualErrorMessage("Please enter a Job Title.");
      return;
    }
    if (!manualDepartmentId) {
      setManualErrorMessage("Please select a Department.");
      return;
    }

    const finalDescription = getEffectiveManualDescription();
    if (!finalDescription.trim()) {
      setManualErrorMessage("Please fill in the structured fields or write a job description.");
      return;
    }

    setManualSubmitting(true);
    setManualErrorMessage(null);
    setManualSuccessMessage(null);

    const skillsArray = manualParsedSkills.length > 0 ? manualParsedSkills : ["General"];

    try {
      const hiringRequest = await apiRequest<HiringRequestApiRecord>({
        path: "/hiring-requests/",
        method: "POST",
        body: JSON.stringify({
          title: manualTitle.trim(),
          description: finalDescription.trim(),
          required_skills: skillsArray,
          experience_level: manualExperienceLevel || null,
          headcount: 1,
          department_id: Number(manualDepartmentId),
          ai_summary: finalDescription.trim().slice(0, 220),
          match_score: null,
          parsed_data: {
            max_budget: manualBudget || null,
            budget: manualBudget || null,
            location: manualLocation || "Location not set",
            employment_type: manualEmploymentType || "Full-time",
            work_model: manualWorkModel || "Hybrid",
            pdf_url: manualPdfUrl || null,
            target_portal: manualTargetPortal || "both",
            about_role: manualAboutRole.trim(),
            responsibilities: manualResponsibilities.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean),
            requirements: manualRequirements.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean),
            nice_to_have: manualNiceToHave.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean),
            additional_info: manualAdditionalInfo.trim(),
            source: "manual-intake",
          },
        }),
      });

      setManualSuccessMessage(
        `Job saved as Hiring Request #${hiringRequest.id} for HR review and approval!`
      );
    } catch (err) {
      setManualErrorMessage(
        err instanceof Error ? err.message : "Failed to create hiring request."
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleManualClear = () => {
    setManualTitle("");
    setManualDepartmentId("");
    setManualLocation("");
    setManualEmploymentType("Full-time");
    setManualExperienceLevel("Mid-level");
    setManualWorkModel("Hybrid");
    setManualBudget("");
    setManualHoursPerWeek("40");
    setManualSkills("");
    setManualPdfUrl("");
    setManualTargetPortal("all");
    setManualPublished(true);
    setManualDescription("");
    setManualCompanyInfo("");
    setManualAboutRole("");
    setManualResponsibilities("");
    setManualRequirements("");
    setManualNiceToHave("");
    setManualAdditionalInfo("");
    setManualErrorMessage(null);
    setManualSuccessMessage(null);
    setManualCreatedVacancyId(null);
    setPortalPublishResult(null);
  };

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------
          MODE SWITCHER TABS (AI vs MANUAL)
      ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#1b262d] bg-[#0c1012] p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`flex items-center gap-2.5 rounded-[14px] px-5 py-3 text-sm font-semibold transition ${
              mode === "ai"
                ? "border border-[#19def0]/40 bg-[rgba(18,212,233,0.12)] text-[#19def0] shadow-[0_0_24px_rgba(25,222,240,0.18)]"
                : "text-[#8ea2b2] hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <WandSparkles className="h-4 w-4" />
            <span>AI Assisted Generator</span>
            <span className="rounded-full bg-[#19def0]/15 px-2.5 py-0.5 text-[0.7rem] font-bold text-[#19def0]">
              Prompt Flow
            </span>
          </button>

          <button
            type="button"
            onClick={handleSwitchToManual}
            className={`flex items-center gap-2.5 rounded-[14px] px-5 py-3 text-sm font-semibold transition ${
              mode === "manual"
                ? "border border-[#19def0]/40 bg-[rgba(18,212,233,0.12)] text-[#19def0] shadow-[0_0_24px_rgba(25,222,240,0.18)]"
                : "text-[#8ea2b2] hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Manual Job Posting</span>
            <span className="rounded-full bg-[#3bf28a]/15 px-2.5 py-0.5 text-[0.7rem] font-bold text-[#3bf28a]">
              
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 px-3 text-xs text-[#8299a9]">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#19def0] animate-pulse" />
          <span>
            {mode === "ai"
              ? "Draft from role brief with AI"
              : "Open fields manual entry — Title, Content, Type, Location, PDF"}
          </span>
        </div>
      </div>

      {/* ----------------------------------------------------
          TAB 1: AI GENERATOR MODE (ORIGINAL VIEW ENHANCED)
      ---------------------------------------------------- */}
      {mode === "ai" ? (
        <div className="grid gap-6 xl:grid-cols-[1.02fr_1fr]">
          {/* Left Column: AI Prompts */}
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
                      <p className="text-sm text-[#87a0b1]">
                        Turn a short role brief into an HR-ready vacancy draft.
                      </p>
                    </div>
                  </div>
                  <p className="max-w-xl text-sm leading-7 text-[#98afbf]">
                    Describe as much or as little as you want. AI will generate a polished draft, or switch to{" "}
                    <button
                      type="button"
                      onClick={handleSwitchToManual}
                      className="font-medium text-[#19def0] underline decoration-[#19def0]/40 underline-offset-4 hover:text-[#57eaff]"
                    >
                      Manual Mode
                    </button>{" "}
                    for full open fields.
                  </p>
                </div>

                <div className="inline-flex items-center rounded-[8px] border border-[#1b808e] bg-[rgba(8,39,44,0.9)] px-4 py-2 text-[0.83rem] font-semibold uppercase tracking-[0.24em] text-[#1dd8ea]">
                  Step 01
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {/* Quick Status Cards */}
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

                <StudioField label="Max budget" hint="Leave blank to let AI suggest a local market rate.">
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
                    <option value="Temporary">Temporary</option>
                    <option value="Internship">Internship</option>
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
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
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
                  className="min-h-[140px] rounded-[16px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                />
              </StudioField>

              <StudioField
                label="Perks and benefits prompts"
                hint="AI will shape this into a cohesive benefits section in the job description."
              >
                <Textarea
                  value={perks}
                  onChange={(event) => setPerks(event.target.value)}
                  className="min-h-[110px] rounded-[16px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                />
              </StudioField>

              {generateErrorMessage ? (
                <div className="rounded-[18px] border border-[#6d2f37] bg-[rgba(109,47,55,0.24)] px-5 py-4 text-sm text-[#f0b6bf]">
                  {generateErrorMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!jobTitle || generateState === "generating"}
                  icon={Sparkles}
                  className="h-13 rounded-[14px] bg-[linear-gradient(135deg,#00b4d8_0%,#0077b6_100%)] px-8 text-base font-semibold shadow-[0_12px_28px_rgba(0,180,216,0.3)] transition hover:brightness-110"
                >
                  {generateState === "generating" ? "Generating Draft..." : "Generate With AI"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  icon={Eraser}
                  onClick={handleClearDraft}
                  className="h-13 rounded-[14px] border-[#223038] bg-[#101416] px-6 text-sm text-[#9ab0bf] hover:text-white"
                >
                  Clear Prompts
                </Button>
              </div>
            </div>
          </section>

          {/* Right Column: AI Output */}
          <section className="overflow-hidden rounded-[26px] border border-[#1e2d35] bg-[#0d1012] shadow-[0_28px_60px_rgba(0,0,0,0.34)]">
            <div className="border-b border-[#18252c] bg-[linear-gradient(180deg,rgba(16,23,27,0.95)_0%,rgba(13,16,18,0.96)_100%)] px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#124854] bg-[rgba(18,212,233,0.1)] shadow-[0_0_24px_rgba(18,212,233,0.14)]">
                    <FileText className="h-5 w-5 text-[#19def0]" />
                  </div>
                  <div>
                    <h2 className="text-[1.15rem] font-semibold text-white sm:text-[1.35rem]">
                      AI Job Description Output
                    </h2>
                    <p className="text-sm text-[#87a0b1]">
                      Edit the generated vacancy directly in the text box below.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[#a4b7c5]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#1b252b] bg-[#111517]">
                    <Bold className="h-4 w-4" />
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#1b252b] bg-[#111517]">
                    <Italic className="h-4 w-4" />
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#1b252b] bg-[#111517]">
                    <List className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="rounded-[22px] border border-[#18252c] bg-[#111517] p-4">
                {generateState === "generating" ? (
                  <div className="rounded-[18px] p-6">
                    <div className="flex min-h-[560px] flex-col items-center justify-center gap-5 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#154b55] bg-[rgba(12,43,48,0.55)]">
                        <LoaderCircle className="h-8 w-8 animate-spin text-[#19def0]" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-base font-semibold text-white">AI is creating a job description</p>
                        <p className="text-sm text-[#8fa3b5]">
                          Please wait while we generate a polished draft for this role.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : generatedDescription ? (
                  <div className="space-y-5">
                    {summary ? (
                      <div className="rounded-[16px] border border-[#1a252c] bg-[#0d1113] px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ea2b3]">
                          Summary
                        </p>
                        <p className="mt-2 text-[0.98rem] leading-7 text-[#d9e5ee]">{summary}</p>
                      </div>
                    ) : null}

                    <div>
                      <Textarea
                        value={generatedDescription}
                        onChange={(event) => setGeneratedDescription(event.target.value)}
                        placeholder="Your generated job description will appear here and can be edited before approval."
                        className="min-h-[500px] rounded-[16px] border-[#1a252c] bg-[#07090a] px-5 py-5 text-[0.98rem] leading-8 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                      />
                    </div>

                    {generatedSkills.length > 0 ? (
                      <div className="rounded-[16px] border border-[#1a252c] bg-[#0d1113] px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8ea2b3]">
                          Extracted skills
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {generatedSkills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full border border-[#18424a] bg-[rgba(18,212,233,0.08)] px-3 py-1 text-xs font-medium text-[#9fefff]"
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
                        onClick={handleOpenAiPublishModal}
                        disabled={
                          !jobTitle ||
                          !departmentId ||
                          !generatedDescription ||
                          approvalState === "submitting" ||
                          approvalState === "approved"
                        }
                        icon={Send}
                        className="h-11 rounded-xl bg-[linear-gradient(135deg,#00b4d8_0%,#0077b6_100%)] px-6 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
                      >
                        {approvalState === "submitting"
                          ? "Publishing..."
                          : approvalState === "approved"
                            ? "Published to Portals"
                            : "Publish to Websites"}
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
                  <div className="flex min-h-[560px] flex-col items-center justify-center rounded-[18px] bg-[#07090a] px-8 text-center">
                    <div className="max-w-md space-y-5">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#15343c] bg-[rgba(18,212,233,0.08)]">
                        <FileText className="h-7 w-7 text-[#19def0]" />
                      </div>
                      <p className="text-[1.02rem] leading-7 text-[#7a8d9b]">
                        The generated job description will appear here as one editable vacancy text.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setGeneratedDescription(
                              `Role Overview:\nWe are seeking a talented ${jobTitle || "professional"} to join our team...\n\nKey Responsibilities:\n• \n• \n\nRequirements:\n• \n• `
                            );
                            setGenerateState("generated");
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#19def0]/30 bg-[#19def0]/10 px-5 py-2.5 text-xs font-semibold text-[#19def0] transition hover:bg-[#19def0]/20"
                        >
                          <PenLine className="h-4 w-4" />
                          Write / Paste Manually in Editor
                        </button>

                        <button
                          type="button"
                          onClick={handleSwitchToManual}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-[#c7d5df] transition hover:bg-white/[0.08] hover:text-white"
                        >
                          <FileText className="h-4 w-4" />
                          Open Full Manual Form
                        </button>
                      </div>
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
      ) : (
        /* ----------------------------------------------------
            TAB 2: MANUAL JOB POSTING (ITWW ADMIN STYLE)
        ---------------------------------------------------- */
        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          {/* Left Column: All Open Input Fields */}
          <section className="overflow-hidden rounded-[26px] border border-[#1e2d35] bg-[#0d1012] shadow-[0_28px_60px_rgba(0,0,0,0.34)]">
            <div className="border-b border-[#18252c] bg-[linear-gradient(180deg,rgba(16,23,27,0.95)_0%,rgba(13,16,18,0.96)_100%)] px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#124854] bg-[rgba(18,212,233,0.1)] shadow-[0_0_24px_rgba(18,212,233,0.14)]">
                      <FileText className="h-5 w-5 text-[#19def0]" />
                    </div>
                    <div>
                      <h2 className="text-[1.15rem] font-semibold text-white sm:text-[1.35rem]">
                        Manual Job Details
                      </h2>
                      <p className="text-sm text-[#87a0b1]">
                        Open fields matching ITWW Admin — fill details and publish directly.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="inline-flex items-center rounded-[8px] border border-[#1b808e] bg-[rgba(8,39,44,0.9)] px-4 py-2 text-[0.83rem] font-semibold uppercase tracking-[0.24em] text-[#1dd8ea]">
                  Direct Entry
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              {/* Job Title */}
              <StudioField label="Job Title *">
                <Input
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] text-[1.05rem] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                />
              </StudioField>

              {/* Department & Location */}
              <div className="grid gap-5 md:grid-cols-2">
                <StudioField label="Department *">
                  <Select
                    value={manualDepartmentId}
                    onChange={(e) => setManualDepartmentId(e.target.value)}
                    className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                  >
                    <option value="" disabled>
                      Select department
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </Select>
                </StudioField>

                <StudioField label="Location">
                  <Input
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    placeholder="e.g. Amsterdam, Netherlands (or Remote)"
                    className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                  />
                </StudioField>
              </div>

              {/* Type, Setup, Experience Level */}
              <div className="grid gap-5 md:grid-cols-3">
                <StudioField label="Employment Type">
                  <Select
                    value={manualEmploymentType}
                    onChange={(e) => setManualEmploymentType(e.target.value)}
                    className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Internship">Internship</option>
                    <option value="Temporary">Temporary</option>
                  </Select>
                </StudioField>

                <StudioField label="Work Setup">
                  <Select
                    value={manualWorkModel}
                    onChange={(e) => setManualWorkModel(e.target.value)}
                    className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                  </Select>
                </StudioField>

                <StudioField label="Experience Level">
                  <Select
                    value={manualExperienceLevel}
                    onChange={(e) => setManualExperienceLevel(e.target.value)}
                    className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Mid-level">Mid-level</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                    <option value="Executive">Executive</option>
                    <option value="Not specified">Not specified</option>
                  </Select>
                </StudioField>
              </div>

              {/* Budget & Hours Per Week */}
              <div className="grid gap-5 md:grid-cols-2">
                <StudioField label="Budget / Salary" hint="e.g. EUR 65,000 / year or Competitive">
                  <Input
                    value={manualBudget}
                    onChange={(e) => setManualBudget(e.target.value)}
                    placeholder="EUR 60,000"
                    className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                  />
                </StudioField>

                <StudioField label="Hours Per Week (Staff Outsourcing & Portals)" hint="e.g. 40, 36, or 32 hours/week">
                  <Input
                    type="number"
                    value={manualHoursPerWeek}
                    onChange={(e) => setManualHoursPerWeek(e.target.value)}
                    placeholder="40"
                    min="1"
                    max="60"
                    className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                  />
                </StudioField>
              </div>

              {/* Target Portal Selection */}
              <StudioField
                label="Target Career Portal(s)"
                hint="You will also be asked to confirm your chosen destination portal(s) before publishing."
              >
                <Select
                  value={manualTargetPortal}
                  onChange={(e) => setManualTargetPortal(e.target.value)}
                  className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                >
                  <option value="all">All 3 Portals (ITWW, ISH & Staff Outsourcing)</option>
                  <option value="itww">IT Solutions Worldwide (ITWW)</option>
                  <option value="ish">IT Solutions Hub (ISH)</option>
                  <option value="dinel">Staff Outsourcing</option>
                </Select>
              </StudioField>

              {/* Featured Document / PDF URL (ITWW Admin style) */}
              <StudioField
                label="Featured PDF / Document URL"
                hint="Matching ITWW & ISH Admin's pdf_url field — URL to the vacancy flyer, spec, or JD PDF."
              >
                <div className="flex gap-2">
                  <Input
                    value={manualPdfUrl}
                    onChange={(e) => setManualPdfUrl(e.target.value)}
                    placeholder="https://.../job-document.pdf or /storage/..."
                    className="h-14 flex-1 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                  />
                  {manualPdfUrl ? (
                    <a
                      href={manualPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-14 items-center justify-center gap-1.5 rounded-[14px] border border-[#19def0]/40 bg-[#19def0]/10 px-4 text-xs font-semibold text-[#19def0] hover:bg-[#19def0]/20"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View
                    </a>
                  ) : null}
                </div>
              </StudioField>

              {/* Required Skills & Tags */}
              <StudioField
                label="Required Skills & Keywords"
                hint="Comma-separated skills (e.g. Python, FastAPI, PostgreSQL, Docker, AWS)"
              >
                <Input
                  value={manualSkills}
                  onChange={(e) => setManualSkills(e.target.value)}
                  placeholder="Python, FastAPI, SQLModel, Docker, AWS"
                  className="h-14 rounded-[14px] border-[#1c262c] bg-[#101214] focus:border-[#18d8ea]/40 focus:bg-[#12181b]"
                />
              </StudioField>

              {/* Live Skills Tags Preview */}
              {manualParsedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {manualParsedSkills.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#18424a] bg-[rgba(18,212,233,0.08)] px-3 py-1 text-xs font-medium text-[#9fefff]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Published Live Toggle (ITWW Admin style checkbox) */}
              <div className="rounded-[16px] border border-[#1c262c] bg-[#101214] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={manualPublished}
                    onChange={(e) => setManualPublished(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-[#1e2d35] bg-[#0c1012] text-[#19def0] accent-[#19def0] focus:ring-0"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-white">
                      Publish Vacancy Immediately (Status: Open)
                    </span>
                    <span className="block text-xs leading-5 text-[#7e94a4]">
                      When checked, vacancy is set to &quot;Open&quot; and publishes directly to the selected career portal(s). Uncheck to save as draft / on-hold.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* Right Column: Full Job Content & Description (Structured + Raw Markdown) */}
          <section className="overflow-hidden rounded-[26px] border border-[#1e2d35] bg-[#0d1012] shadow-[0_28px_60px_rgba(0,0,0,0.34)]">
            <div className="border-b border-[#18252c] bg-[linear-gradient(180deg,rgba(16,23,27,0.95)_0%,rgba(13,16,18,0.96)_100%)] px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#124854] bg-[rgba(18,212,233,0.1)] shadow-[0_0_24px_rgba(18,212,233,0.14)]">
                    <PenLine className="h-5 w-5 text-[#19def0]" />
                  </div>
                  <div>
                    <h2 className="text-[1.15rem] font-semibold text-white sm:text-[1.35rem]">
                      Job Content & Description
                    </h2>
                    <p className="text-sm text-[#87a0b1]">
                      Follows ITWW & ISH career page format with clean structured sections.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Structured vs Raw Toggle */}
                  <div className="inline-flex rounded-xl border border-white/10 bg-[#07090a] p-1">
                    <button
                      type="button"
                      onClick={() => setManualContentTab("structured")}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                        manualContentTab === "structured"
                          ? "bg-[#19def0] text-[#00201e]"
                          : "text-[#87a0b1] hover:text-white"
                      }`}
                    >
                      Structured Fields
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!manualDescription && (manualAboutRole || manualResponsibilities)) {
                          setManualDescription(
                            composeStructuredJobContent(
                              manualAboutRole,
                              manualResponsibilities,
                              manualRequirements,
                              manualNiceToHave,
                              manualAdditionalInfo
                            )
                          );
                        }
                        setManualContentTab("raw");
                      }}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                        manualContentTab === "raw"
                          ? "bg-[#19def0] text-[#00201e]"
                          : "text-[#87a0b1] hover:text-white"
                      }`}
                    >
                      Raw Markdown
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleInsertManualTemplate}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#19def0]/30 bg-[#19def0]/10 px-3 py-1.5 text-xs font-semibold text-[#19def0] transition hover:bg-[#19def0]/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Insert Template
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualDescription("");
                      setManualAboutRole("");
                      setManualResponsibilities("");
                      setManualRequirements("");
                      setManualNiceToHave("");
                      setManualAdditionalInfo("");
                    }}
                    className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[#8ca2b2] transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              {manualContentTab === "structured" ? (
                /* STRUCTURED FIELDS (Staff Outsourcing, ISH & ITWW Style) */
                <div className="space-y-4">
                  {/* Company Overview (Staff Outsourcing & Portals) */}
                  <StudioField
                    label="Company Overview (Staff Outsourcing & Portals)"
                    hint="Company introduction rendered at the top of the job post on Staff Outsourcing and career portals"
                  >
                    <Textarea
                      value={manualCompanyInfo}
                      onChange={(e) => {
                        setManualCompanyInfo(e.target.value);
                        setManualDescription(
                          composeStructuredJobContent(
                            manualAboutRole,
                            manualResponsibilities,
                            manualRequirements,
                            manualNiceToHave,
                            manualAdditionalInfo,
                            e.target.value
                          )
                        );
                      }}
                      placeholder="Staff Outsourcing & IT Solutions Worldwide provides specialized technical, engineering, and digital talent solutions across Europe and globally..."
                      className="min-h-[85px] rounded-[14px] border-[#1a252c] bg-[#07090a] px-4 py-3 text-[0.94rem] leading-7 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                    />
                  </StudioField>

                  {/* 1. About the Role */}
                  <StudioField
                    label="About the Role"
                    hint="General paragraph introducing the role, department, and company overview (intro_information on Staff Outsourcing)"
                  >
                    <Textarea
                      value={manualAboutRole}
                      onChange={(e) => {
                        setManualAboutRole(e.target.value);
                        setManualDescription(
                          composeStructuredJobContent(
                            e.target.value,
                            manualResponsibilities,
                            manualRequirements,
                            manualNiceToHave,
                            manualAdditionalInfo,
                            manualCompanyInfo
                          )
                        );
                      }}
                      placeholder="We are seeking an experienced professional to join our European operations..."
                      className="min-h-[110px] rounded-[14px] border-[#1a252c] bg-[#07090a] px-4 py-3 text-[0.94rem] leading-7 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                    />
                  </StudioField>

                  {/* 2. Key Responsibilities */}
                  <StudioField
                    label="Key Responsibilities (vacancy_information)"
                    hint="One line per bullet point (auto-formatted with bullet points on portal)"
                  >
                    <Textarea
                      value={manualResponsibilities}
                      onChange={(e) => {
                        setManualResponsibilities(e.target.value);
                        setManualDescription(
                          composeStructuredJobContent(
                            manualAboutRole,
                            e.target.value,
                            manualRequirements,
                            manualNiceToHave,
                            manualAdditionalInfo,
                            manualCompanyInfo
                          )
                        );
                      }}
                      placeholder={"Lead key deliverables and technical implementations\nTroubleshoot, maintain, and upgrade systems\nWork closely with internal and cross-functional teams\nMaintain quality control, documentation, and compliance"}
                      className="min-h-[120px] rounded-[14px] border-[#1a252c] bg-[#07090a] px-4 py-3 text-[0.94rem] leading-7 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                    />
                  </StudioField>

                  {/* 3. Requirements */}
                  <StudioField
                    label="Requirements & Qualifications (requirements)"
                    hint="One line per bullet point (experience, skills, certifications, language)"
                  >
                    <Textarea
                      value={manualRequirements}
                      onChange={(e) => {
                        setManualRequirements(e.target.value);
                        setManualDescription(
                          composeStructuredJobContent(
                            manualAboutRole,
                            manualResponsibilities,
                            e.target.value,
                            manualNiceToHave,
                            manualAdditionalInfo,
                            manualCompanyInfo
                          )
                        );
                      }}
                      placeholder={"2+ years relevant hands-on technical experience\nStrong analytical and problem-solving skills\nFluent verbal and written communication in English\nSelf-motivated and able to work independently"}
                      className="min-h-[120px] rounded-[14px] border-[#1a252c] bg-[#07090a] px-4 py-3 text-[0.94rem] leading-7 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                    />
                  </StudioField>

                  {/* 4. Nice to Have / What We Offer */}
                  <StudioField
                    label="What We Offer / Benefits (offer_information on Staff Outsourcing)"
                    hint="One line per bullet point (bonus certifications, perks, benefits)"
                  >
                    <Textarea
                      value={manualNiceToHave}
                      onChange={(e) => {
                        setManualNiceToHave(e.target.value);
                        setManualDescription(
                          composeStructuredJobContent(
                            manualAboutRole,
                            manualResponsibilities,
                            manualRequirements,
                            e.target.value,
                            manualAdditionalInfo,
                            manualCompanyInfo
                          )
                        );
                      }}
                      placeholder={"Competitive compensation package with growth opportunities\nComprehensive health and pension benefits\nSupport for professional development and technical certifications\nCompany travel or mobility allowance where applicable"}
                      className="min-h-[90px] rounded-[14px] border-[#1a252c] bg-[#07090a] px-4 py-3 text-[0.94rem] leading-7 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                    />
                  </StudioField>

                  {/* 5. Additional Information */}
                  <StudioField
                    label="Additional Information (additional_information)"
                    hint="Extra notes, visa sponsorship, relocation support, or schedule breakdown"
                  >
                    <Textarea
                      value={manualAdditionalInfo}
                      onChange={(e) => {
                        setManualAdditionalInfo(e.target.value);
                        setManualDescription(
                          composeStructuredJobContent(
                            manualAboutRole,
                            manualResponsibilities,
                            manualRequirements,
                            manualNiceToHave,
                            e.target.value,
                            manualCompanyInfo
                          )
                        );
                      }}
                      placeholder="e.g. Visa sponsorship provided for qualified overseas candidates. Relocation and flight assistance included."
                      className="min-h-[85px] rounded-[14px] border-[#1a252c] bg-[#07090a] px-4 py-3 text-[0.94rem] leading-7 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                    />
                  </StudioField>
                </div>
              ) : (
                /* RAW MARKDOWN TEXTAREA */
                <div className="rounded-[20px] border border-[#18252c] bg-[#111517] p-4">
                  <Textarea
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder={`## About the Role\n...\n\n## Key Responsibilities\n- ...\n\n## Requirements\n- ...\n\n## Nice to Have\n- ...`}
                    className="min-h-[460px] rounded-[16px] border-[#1a252c] bg-[#07090a] px-5 py-5 text-[0.98rem] leading-8 text-white focus:border-[#18d8ea]/35 focus:bg-[#090c0d]"
                  />
                </div>
              )}

              {/* Status and Word Count */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-1 text-sm text-[#6f8492]">
                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>{manualWordCount} words</span>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span>{manualDescription.length} characters</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 text-[#84e8a5]">
                  <span className="h-2 w-2 rounded-full bg-[#1dd75f]" />
                  <span>Ready to post</span>
                </div>
              </div>

              {/* Success Notification */}
              {manualSuccessMessage ? (
                <div className="rounded-[18px] border border-[#1f5c48] bg-[rgba(24,74,57,0.26)] p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 text-[#75eb9d]" />
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[#d8f1e0]">{manualSuccessMessage}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href="/vacancies"
                          className="inline-flex items-center gap-2 rounded-xl bg-[#007774] px-4 py-2 text-xs font-bold text-[#a1fcf7] hover:brightness-110"
                        >
                          <BriefcaseBusiness className="h-4 w-4" />
                          View In Vacancies
                        </Link>
                        <Link
                          href="/jobs"
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.08]"
                        >
                          <Globe className="h-4 w-4" />
                          View Public Careers
                        </Link>
                        <button
                          type="button"
                          onClick={handleManualClear}
                          className="text-xs text-[#95a8b8] underline decoration-white/20 underline-offset-4 hover:text-white"
                        >
                          Post another vacancy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Error Notification */}
              {manualErrorMessage ? (
                <div className="rounded-[18px] border border-[#6d2f37] bg-[rgba(109,47,55,0.24)] px-5 py-4 text-sm text-[#f0b6bf]">
                  {manualErrorMessage}
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  type="button"
                  onClick={() => handleManualPublish(false)}
                  disabled={manualSubmitting || !manualTitle || !manualDepartmentId}
                  icon={Send}
                  className="h-13 rounded-[14px] bg-[linear-gradient(135deg,#00b4d8_0%,#0077b6_100%)] px-8 text-base font-semibold text-white shadow-[0_12px_28px_rgba(0,180,216,0.3)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {manualSubmitting
                    ? "Publishing..."
                    : manualPublished
                      ? "Publish Vacancy Directly"
                      : "Save Vacancy (On Hold)"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleManualSaveIntake}
                  disabled={manualSubmitting || !manualTitle || !manualDepartmentId}
                  className="h-13 rounded-[14px] border-[#223038] bg-[#101416] px-6 text-sm text-[#9ab0bf] hover:text-white"
                >
                  Save as HR Intake Request
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  icon={Eraser}
                  onClick={handleManualClear}
                  className="h-13 rounded-[14px] border-[#223038] bg-[#101416] px-5 text-sm text-[#9ab0bf] hover:text-white"
                >
                  Reset Form
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ----------------------------------------------------
          PORTAL SELECTION & CONFIRMATION PROMPT MODAL
      ---------------------------------------------------- */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-[26px] border border-[#2b3a42] bg-[#0c1012] p-7 shadow-[0_30px_70px_rgba(0,0,0,0.7)] text-left">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setPublishModalOpen(false)}
              disabled={portalPublishing}
              className="absolute right-5 top-5 rounded-lg p-1.5 text-[#859491] hover:bg-white/10 hover:text-white transition disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#19def0]/30 bg-[#19def0]/10 text-[#19def0] shadow-[0_0_20px_rgba(25,222,240,0.18)]">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-[#19def0]">
                  Destination Portals Confirmation
                </span>
                <h3 className="text-xl font-bold text-white">Where do you want to publish?</h3>
              </div>
            </div>

            <p className="text-sm text-[#8ca2b2] mb-5">
              Select which career portals this vacancy should be posted to. Each selected portal database will receive the vacancy formatted for its layout without creating duplicates.
            </p>

            {/* Role Summary Mini-Card */}
            <div className="mb-5 rounded-xl border border-white/10 bg-[#12181c] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-white text-sm">
                  {publishModalSource === "ai"
                    ? jobTitle || "Untitled Role"
                    : manualTitle || "Untitled Role"}
                </span>
                <span className="rounded-md border border-[#19def0]/30 bg-[#19def0]/10 px-2 py-0.5 text-[11px] font-medium text-[#19def0]">
                  {publishModalSource === "ai"
                    ? selectedDepartment?.name || "General"
                    : selectedManualDepartment?.name || "General"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#7e94a4]">
                <span>
                  {publishModalSource === "ai"
                    ? [city, country].filter(Boolean).join(", ") || "Netherlands"
                    : manualLocation || "Netherlands"}
                </span>
                <span>•</span>
                <span>{publishModalSource === "ai" ? workModel : manualWorkModel}</span>
                <span>•</span>
                <span>
                  {publishModalSource === "ai"
                    ? `${employmentType} (${workHours ? `${workHours} hrs/wk` : "40 hrs/wk"})`
                    : `${manualEmploymentType} (${manualHoursPerWeek} hrs/wk)`}
                </span>
                {(publishModalSource === "ai" ? maxBudget : manualBudget) ? (
                  <>
                    <span>•</span>
                    <span>{publishModalSource === "ai" ? maxBudget : manualBudget}</span>
                  </>
                ) : null}
              </div>
            </div>

            {/* 3 Selectable Portal Cards */}
            <div className="space-y-3 mb-6">
              {/* Option 1: ITWW */}
              <div
                onClick={() => !portalPublishing && togglePortal("itww")}
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition ${
                  selectedPortals.includes("itww")
                    ? "border-[#19def0] bg-[#19def0]/10 shadow-[0_0_16px_rgba(25,222,240,0.12)]"
                    : "border-white/10 bg-[#101417] hover:border-white/20"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                    selectedPortals.includes("itww")
                      ? "border-[#19def0] bg-[#19def0] text-[#00201e]"
                      : "border-white/20 bg-transparent"
                  }`}
                >
                  {selectedPortals.includes("itww") && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#19def0]" />
                      <span className="font-semibold text-white text-sm">
                        IT Solutions Worldwide (ITWW)
                      </span>
                    </div>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-[#8ca2b2]">
                      it-solutions-worldwide2
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#7e94a4]">
                    Syncs to ITWW PostgreSQL jobs_infos table with structured markdown sections.
                  </p>
                </div>
              </div>

              {/* Option 2: ISH */}
              <div
                onClick={() => !portalPublishing && togglePortal("ish")}
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition ${
                  selectedPortals.includes("ish")
                    ? "border-[#19def0] bg-[#19def0]/10 shadow-[0_0_16px_rgba(25,222,240,0.12)]"
                    : "border-white/10 bg-[#101417] hover:border-white/20"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                    selectedPortals.includes("ish")
                      ? "border-[#19def0] bg-[#19def0] text-[#00201e]"
                      : "border-white/20 bg-transparent"
                  }`}
                >
                  {selectedPortals.includes("ish") && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-[#62f9ee]" />
                      <span className="font-semibold text-white text-sm">
                        IT Solutions Hub (ISH)
                      </span>
                    </div>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-[#8ca2b2]">
                      it-solutions-hub
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#7e94a4]">
                    Syncs to ISH PostgreSQL jobs_infos table with styled role requirements and benefits.
                  </p>
                </div>
              </div>

              {/* Option 3: Staff Outsourcing */}
              <div
                onClick={() => !portalPublishing && togglePortal("dinel")}
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition ${
                  selectedPortals.includes("dinel")
                    ? "border-[#f59e0b] bg-[#f59e0b]/10 shadow-[0_0_16px_rgba(245,158,11,0.15)]"
                    : "border-white/10 bg-[#101417] hover:border-white/20"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                    selectedPortals.includes("dinel")
                      ? "border-[#f59e0b] bg-[#f59e0b] text-[#1b1305]"
                      : "border-white/20 bg-transparent"
                  }`}
                >
                  {selectedPortals.includes("dinel") && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#f59e0b]" />
                      <span className="font-semibold text-white text-sm">
                        Staff Outsourcing
                      </span>
                    </div>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-[#f59e0b]">
                      staff-outsourcing
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#7e94a4]">
                    Posts to Staff Outsourcing&apos;s jobs table with company info, vacancy info, requirements, and offer details.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions (Select All / Clear) */}
            <div className="flex items-center justify-between mb-6 text-xs text-[#8ca2b2]">
              <span className="font-medium">
                {selectedPortals.length} of 3 portals selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPortals(["itww", "ish", "dinel"])}
                  className="text-[#19def0] hover:underline"
                >
                  Select All 3
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setSelectedPortals([])}
                  className="text-[#8ca2b2] hover:text-white hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPublishModalOpen(false)}
                disabled={portalPublishing}
                className="h-11 rounded-xl border-[#223038] bg-[#101416] px-5 text-sm text-[#9ab0bf] hover:text-white"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={() => void executePublishWithPortals(selectedPortals)}
                disabled={selectedPortals.length === 0 || portalPublishing}
                icon={portalPublishing ? LoaderCircle : Send}
                className="h-11 rounded-xl bg-[linear-gradient(135deg,#00b4d8_0%,#0077b6_100%)] px-6 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
              >
                {portalPublishing
                  ? "Publishing to Portals..."
                  : `Publish to ${selectedPortals.length} Portal${selectedPortals.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
