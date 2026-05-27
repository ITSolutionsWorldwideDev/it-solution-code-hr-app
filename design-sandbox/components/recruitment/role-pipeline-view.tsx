"use client";

import { useEffect, useMemo, useState } from "react";

import { useRole } from "@/components/providers/role-provider";
import { PipelineBoard } from "@/components/recruitment/pipeline-board";
import { Panel } from "@/components/ui/panel";
import { apiRequest } from "@/lib/api/client";
import { mapApplicationToPipelineCandidate, pipelineStageLabels, pipelineStageOrder } from "@/lib/pipeline";
import type { AppRole } from "@/lib/session";
import type {
  ApplicationApiRecord,
  ApplicationStageApi,
  CandidateApiRecord,
  PipelineCandidateRecord,
  PipelineStage,
  UserApiRecord,
  VacancyApiRecord,
} from "@/lib/recruitment-types";

const stageSets: Record<string, PipelineStage[]> = {
  HR: ["hr_invite_sent", "hr_interview_scheduled", "hr_in_progress", "hr_passed", "rejected"],
  Technical: ["technical_interview_scheduled", "technical_in_progress", "technical_passed", "rejected"],
  Manager: [
    "management_interview_scheduled",
    "management_in_progress",
    "selected",
    "offer_sent",
    "offer_accepted",
    "offer_declined",
    "hired",
    "rejected",
  ],
  Admin: [
    "hr_invite_sent",
    "hr_interview_scheduled",
    "hr_in_progress",
    "hr_passed",
    "technical_interview_scheduled",
    "technical_in_progress",
    "technical_passed",
    "management_interview_scheduled",
    "management_in_progress",
    "selected",
    "offer_sent",
    "offer_accepted",
    "offer_declined",
    "hired",
    "rejected",
  ],
};

const roleCopy = {
  HR: {
    title: "Candidate Pipeline",
    description:
      "Track candidates after the invite email was sent, wait for their approval, and then move them through the HR interview decision.",
  },
  Technical: {
    title: "Technical Candidate Pipeline",
    description:
      "Focus on HR-passed candidates, capture technical interview outcomes, and move approved profiles into management review.",
  },
  Manager: {
    title: "Management Decision Pipeline",
    description:
      "Review technically approved finalists, decide on selection, and monitor offer progression and close-out status.",
  },
  Admin: {
    title: "Full Recruitment Pipeline",
    description:
      "Observe the full intake-to-hire flow across HR screening, technical review, management selection, and offers.",
  },
} as const;

const stageOwners: Record<PipelineStage, string> = {
  applied: "AI Intake",
  ranked: "AI Ranking",
  shortlisted: "HR",
  hr_review: "HR",
  hr_invite_sent: "HR",
  hr_interview_scheduled: "HR",
  hr_in_progress: "HR",
  hr_approved: "Technical",
  hr_passed: "Technical",
  technical_review: "Technical",
  technical_interview_scheduled: "Technical",
  technical_in_progress: "Technical",
  technical_approved: "Management",
  technical_passed: "Management",
  management_review: "Management",
  management_interview_scheduled: "Management",
  management_in_progress: "Management",
  selected: "Management",
  offer_sent: "Management",
  offer_accepted: "HR / Onboarding",
  offer_declined: "Management",
  hired: "HR / Onboarding",
  rejected: "Closed",
};

const roleToUserRole = {
  HR: "HR",
  Technical: "Technical",
  Manager: "Manager",
  Admin: "Admin",
} as const;

const nextStageByRole: Record<AppRole, Partial<Record<ApplicationStageApi, ApplicationStageApi>>> = {
  HR: {
    hr_invite_sent: "hr_interview_scheduled",
    hr_interview_scheduled: "hr_in_progress",
    hr_in_progress: "hr_passed",
  },
  Technical: {
    technical_interview_scheduled: "technical_in_progress",
    technical_in_progress: "technical_passed",
  },
  Manager: {
    management_interview_scheduled: "management_in_progress",
    management_in_progress: "selected",
    selected: "offer_sent",
    offer_sent: "offer_accepted",
    offer_accepted: "hired",
  },
  Admin: {
    hr_invite_sent: "hr_interview_scheduled",
    hr_interview_scheduled: "hr_in_progress",
    hr_in_progress: "hr_passed",
    technical_interview_scheduled: "technical_in_progress",
    technical_in_progress: "technical_passed",
    management_interview_scheduled: "management_in_progress",
    management_in_progress: "selected",
    selected: "offer_sent",
    offer_sent: "offer_accepted",
    offer_accepted: "hired",
  },
};

async function ensureDemoUser(role: AppRole, fullName: string): Promise<UserApiRecord> {
  const users = await apiRequest<UserApiRecord[]>({ path: "/users/" });
  const existing = users.find((user) => user.role === roleToUserRole[role] && user.full_name === fullName);
  if (existing) {
    return existing;
  }

  const emailSlug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, ".");
  return apiRequest<UserApiRecord>({
    path: "/users/",
    method: "POST",
    body: JSON.stringify({
      full_name: fullName,
      email: `${emailSlug}@itsolutionsworldwide.local`,
      role: roleToUserRole[role],
      department_id: null,
    }),
  });
}

function rejectionStageForApplication(applicationStage: ApplicationStageApi): ApplicationStageApi {
  if (applicationStage.startsWith("technical_")) {
    return "technical_rejected";
  }

  if (
    applicationStage.startsWith("management_") ||
    applicationStage === "selected" ||
    applicationStage === "offer_sent" ||
    applicationStage === "offer_accepted"
  ) {
    return "management_rejected";
  }

  return "hr_rejected";
}

export function RolePipelineView() {
  const { role, name } = useRole();
  const content = roleCopy[role];
  const visibleStages = stageSets[role];
  const [applications, setApplications] = useState<ApplicationApiRecord[]>([]);
  const [candidateRecords, setCandidateRecords] = useState<CandidateApiRecord[]>([]);
  const [vacancies, setVacancies] = useState<VacancyApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadPipeline = async () => {
    const [applicationResponse, candidateResponse, vacancyResponse] = await Promise.all([
      apiRequest<ApplicationApiRecord[]>({ path: "/applications/" }),
      apiRequest<CandidateApiRecord[]>({ path: "/candidates/" }),
      apiRequest<VacancyApiRecord[]>({ path: "/vacancies/" }),
    ]);

    setApplications(applicationResponse);
    setCandidateRecords(candidateResponse);
    setVacancies(vacancyResponse);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        await loadPipeline();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load the pipeline.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const pipelineCandidates = useMemo<PipelineCandidateRecord[]>(() => {
    return applications
      .map((application) =>
        mapApplicationToPipelineCandidate(
          application,
          candidateRecords.find((candidate) => candidate.id === application.candidate_id) ?? null,
          vacancies.find((vacancy) => vacancy.id === application.vacancy_id) ?? null,
        ),
      )
      .filter((item): item is PipelineCandidateRecord => item !== null);
  }, [applications, candidateRecords, vacancies]);

  const handleMoveForward = async (applicationId: string) => {
    const application = applications.find((item) => String(item.id) === applicationId);
    const nextStage = application ? nextStageByRole[role][application.stage] : undefined;

    if (!application || !nextStage) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      await apiRequest<ApplicationApiRecord>({
        path: `/applications/${application.id}/stage`,
        method: "PATCH",
        body: JSON.stringify({
          to_stage: nextStage,
          changed_by_id: user.id,
        }),
      });
      await loadPipeline();
      setSuccessMessage("Candidate was moved to the next pipeline stage.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to move candidate forward.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (applicationId: string) => {
    const application = applications.find((item) => String(item.id) === applicationId);

    if (!application) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureDemoUser(role, name);
      await apiRequest<ApplicationApiRecord>({
        path: `/applications/${application.id}/reject`,
        method: "PATCH",
        body: JSON.stringify({
          rejected_stage: rejectionStageForApplication(application.stage),
          reason: "Rejected from the pipeline workspace.",
          changed_by_id: user.id,
        }),
      });
      await loadPipeline();
      setSuccessMessage("Candidate was moved to Rejected.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reject candidate.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[2.9rem] font-semibold tracking-[-0.04em] text-white">{content.title}</h1>
        <p className="mt-3 max-w-4xl text-[1.05rem] text-[#95a8b8]">{content.description}</p>
      </div>

      <Panel className="rounded-[28px] p-5">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#8ea2b3]">Full Recruitment Flow</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {pipelineStageOrder.map((stage) => {
            const isPrimaryForRole = visibleStages.includes(stage);

            return (
              <div
                key={stage}
                className={`rounded-full border px-3 py-2 text-sm ${
                  isPrimaryForRole
                    ? "border-[#7eb9df]/30 bg-[#466d8a]/18 text-[#d8ecfa]"
                    : "border-white/10 bg-white/[0.03] text-[#95a8b8]"
                }`}
              >
                <span className="font-semibold">{pipelineStageLabels[stage]}</span>
                <span className="ml-2 text-xs uppercase tracking-[0.12em] text-[#86a1b6]">
                  {stageOwners[stage]}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="rounded-[28px] p-5">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#8ea2b3]">Workflow alignment</p>
        <p className="mt-3 text-sm leading-7 text-[#95a8b8]">
          The shortlist and invitation decision happen before the pipeline. After HR sends the email, the candidate
          first appears in the waiting-for-approval column. Once the candidate agrees, HR can move them into a
          scheduled HR meeting. Technical and Management begin when the previous team passes the candidate forward.
        </p>
      </Panel>

      {errorMessage ? (
        <Panel className="rounded-[28px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] p-5 text-sm text-[#f0b6bf]">
          {errorMessage}
        </Panel>
      ) : null}

      {successMessage ? (
        <Panel className="rounded-[28px] border border-[#7eb9df]/20 bg-[#466d8a]/16 p-5 text-sm text-[#dbe8f2]">
          {successMessage}
        </Panel>
      ) : null}

      {loading ? (
        <Panel className="rounded-[28px] p-5 text-sm text-[#95a8b8]">Loading pipeline...</Panel>
      ) : (
        <PipelineBoard
          candidates={pipelineCandidates}
          visibleStages={visibleStages}
          role={role}
          onMoveForward={handleMoveForward}
          onReject={handleReject}
        />
      )}

      {busy ? <p className="text-sm text-[#95a8b8]">Saving pipeline changes...</p> : null}
    </div>
  );
}
