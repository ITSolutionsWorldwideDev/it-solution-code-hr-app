"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";

import { useRole } from "@/components/providers/role-provider";
import { PipelineBoard } from "@/components/recruitment/pipeline-board";
import { apiRequest } from "@/lib/api/client";
import { mapApplicationToPipelineCandidate } from "@/lib/pipeline";
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
  HR: ["hr_invite_sent", "hr_in_progress", "rejected"],
  Technical: ["technical_in_progress", "technical_passed", "rejected"],
  Manager: [
    "technical_passed",
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
    "hr_in_progress",
    "technical_in_progress",
    "technical_passed",
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
    title: "Filtered Candidate Pipeline",
    description: "Review invited candidates and move them through the HR workflow.",
  },
  Technical: {
    title: "Filtered Candidate Pipeline",
    description: "Review HR-passed candidates and move them through the technical workflow.",
  },
  Manager: {
    title: "Filtered Candidate Pipeline",
    description: "Review technically approved finalists and move them through management decisions.",
  },
  Admin: {
    title: "Filtered Candidate Pipeline",
    description: "Observe and manage the full recruitment pipeline.",
  },
} as const;

const roleToUserRole = {
  HR: "HR",
  Technical: "Technical",
  Manager: "Manager",
  Admin: "Admin",
} as const;

function canRoleViewApplication(role: AppRole, application: ApplicationApiRecord): boolean {
  if (role === "Admin") {
    return true;
  }

  const ownerRole = application.current_owner_role;
  if (ownerRole === roleToUserRole[role]) {
    return true;
  }

  if (role === "HR" && application.stage === "hr_rejected") {
    return true;
  }

  if (role === "Technical" && application.stage === "technical_rejected") {
    return true;
  }

  if (role === "Manager" && application.stage === "management_rejected") {
    return true;
  }

  return false;
}

const nextStageByRole: Record<AppRole, Partial<Record<ApplicationStageApi, ApplicationStageApi>>> = {
  HR: {
    hr_invite_sent: "hr_interview_scheduled",
    hr_interview_scheduled: "hr_in_progress",
    hr_in_progress: "technical_interview_scheduled",
  },
  Technical: {
    hr_passed: "technical_interview_scheduled",
    technical_interview_scheduled: "technical_in_progress",
    technical_in_progress: "technical_passed",
  },
  Manager: {
    technical_passed: "management_interview_scheduled",
    management_interview_scheduled: "management_in_progress",
    management_in_progress: "selected",
    selected: "offer_sent",
    offer_sent: "offer_accepted",
    offer_accepted: "hired",
  },
  Admin: {
    hr_invite_sent: "hr_interview_scheduled",
    hr_interview_scheduled: "hr_in_progress",
    hr_in_progress: "technical_interview_scheduled",
    hr_passed: "technical_interview_scheduled",
    technical_interview_scheduled: "technical_in_progress",
    technical_in_progress: "technical_passed",
    technical_passed: "management_interview_scheduled",
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

function approvalStageForApplication(applicationStage: ApplicationStageApi): ApplicationStageApi | null {
  if (applicationStage === "hr_in_progress" || applicationStage === "hr_rejected") {
    return "technical_interview_scheduled";
  }

  if (applicationStage === "technical_in_progress" || applicationStage === "technical_rejected") {
    return "technical_passed";
  }

  if (applicationStage === "management_in_progress" || applicationStage === "management_rejected") {
    return "selected";
  }

  return null;
}

function defaultInterviewDateTimeLocal(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 30, 0, 0);
  return tomorrow.toISOString();
}

function stageTypeForPipelineStage(targetStage: PipelineStage): "hr" | "technical" | "management" | null {
  if (targetStage === "hr_interview_scheduled") {
    return "hr";
  }
  if (targetStage === "technical_interview_scheduled") {
    return "technical";
  }
  if (targetStage === "management_interview_scheduled") {
    return "management";
  }
  return null;
}

function applicationStageForPipelineStage(targetStage: PipelineStage, role: AppRole): ApplicationStageApi | null {
  switch (targetStage) {
    case "hr_invite_sent":
      return "hr_invite_sent";
    case "hr_interview_scheduled":
      return "hr_interview_scheduled";
    case "hr_in_progress":
      return "hr_in_progress";
    case "hr_passed":
      return "hr_passed";
    case "technical_interview_scheduled":
      return "technical_interview_scheduled";
    case "technical_in_progress":
      return "technical_in_progress";
    case "technical_passed":
      return "technical_passed";
    case "management_interview_scheduled":
      return "management_interview_scheduled";
    case "management_in_progress":
      return "management_in_progress";
    case "selected":
      return "selected";
    case "offer_sent":
      return "offer_sent";
    case "offer_accepted":
      return "offer_accepted";
    case "offer_declined":
      return "offer_declined";
    case "hired":
      return "hired";
    case "rejected":
      if (role === "Technical") {
        return "technical_rejected";
      }
      if (role === "Manager") {
        return "management_rejected";
      }
      return "hr_rejected";
    default:
      return null;
  }
}

function targetApplicationStageForPipelineDrop(
  application: ApplicationApiRecord,
  targetStage: PipelineStage,
  role: AppRole,
): ApplicationStageApi | null {
  if (targetStage === "rejected") {
    return rejectionStageForApplication(application.stage);
  }

  if (targetStage === "hr_in_progress") {
    if (application.stage === "hr_rejected") {
      return "hr_interview_scheduled";
    }
    if (application.stage === "hr_invite_sent") {
      return "hr_interview_scheduled";
    }
    return "hr_in_progress";
  }

  if (targetStage === "technical_in_progress") {
    if (application.stage === "technical_rejected") {
      return "technical_interview_scheduled";
    }
    if (application.stage === "hr_rejected" || application.stage === "hr_in_progress" || application.stage === "hr_passed") {
      return "technical_interview_scheduled";
    }
    return "technical_in_progress";
  }

  if (targetStage === "management_in_progress") {
    if (application.stage === "management_rejected") {
      return "management_interview_scheduled";
    }
    if (application.stage === "technical_in_progress" || application.stage === "technical_passed") {
      return "management_interview_scheduled";
    }
    return "management_in_progress";
  }

  return applicationStageForPipelineStage(targetStage, role);
}

export function RolePipelineView() {
  const { role, name } = useRole();
  const content = roleCopy[role];
  const visibleStages = stageSets[role];
  const [applications, setApplications] = useState<ApplicationApiRecord[]>([]);
  const [candidateRecords, setCandidateRecords] = useState<CandidateApiRecord[]>([]);
  const [vacancies, setVacancies] = useState<VacancyApiRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserApiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rejectionEmailSentIds, setRejectionEmailSentIds] = useState<string[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

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

  const updateApplicationInState = (updatedApplication: ApplicationApiRecord) => {
    startTransition(() => {
      setApplications((current) =>
        current.map((application) => (application.id === updatedApplication.id ? updatedApplication : application)),
      );
    });
  };

  const loadSingleApplication = async (applicationId: number) => {
    const refreshedApplication = await apiRequest<ApplicationApiRecord>({
      path: `/applications/${applicationId}`,
    });
    updateApplicationInState(refreshedApplication);
  };

  const ensureCurrentUser = async () => {
    if (currentUser) {
      return currentUser;
    }

    const user = await ensureDemoUser(role, name);
    setCurrentUser(user);
    return user;
  };

  useEffect(() => {
    setCurrentUser(null);
  }, [role, name]);

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
  }, [role]);

  useEffect(() => {
    void ensureCurrentUser().catch(() => {
      // Keep the pipeline usable even if the demo-user bootstrap is temporarily unavailable.
    });
  }, [role, name]);

  const pipelineCandidates = useMemo<PipelineCandidateRecord[]>(() => {
    return applications
      .filter((application) => canRoleViewApplication(role, application))
      .map((application) =>
        mapApplicationToPipelineCandidate(
          application,
          candidateRecords.find((candidate) => candidate.id === application.candidate_id) ?? null,
          vacancies.find((vacancy) => vacancy.id === application.vacancy_id) ?? null,
        ),
      )
      .filter((item): item is PipelineCandidateRecord => item !== null)
      .map((item) => ({
        ...item,
        rejectionEmailSent: rejectionEmailSentIds.includes(item.id),
      }));
  }, [applications, candidateRecords, rejectionEmailSentIds, role, vacancies]);

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    return pipelineCandidates.filter((candidate) => {
      const matchesVacancy = selectedVacancyId === "all" || candidate.vacancyId === selectedVacancyId;
      const matchesQuery =
        !normalizedQuery ||
        candidate.name.toLowerCase().includes(normalizedQuery) ||
        candidate.role.toLowerCase().includes(normalizedQuery);

      return matchesVacancy && matchesQuery;
    });
  }, [pipelineCandidates, deferredSearchQuery, selectedVacancyId]);

  const handleMoveForward = async (applicationId: string) => {
    const application = applications.find((item) => String(item.id) === applicationId);
    const nextStage = application ? nextStageByRole[role][application.stage] : undefined;

    if (!application) {
      return;
    }

    setBusyApplicationId(applicationId);
    setBusyMessage("Updating candidate stage...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureCurrentUser();

      if (application.stage === "hr_invite_selected") {
        setBusyMessage("Sending invitation email...");
        const response = await apiRequest<{ message: string }>({
          path: `/applications/${application.id}/send-hr-invite`,
          method: "POST",
          body: JSON.stringify({
            sent_by_id: user.id,
          }),
        });
        await loadSingleApplication(application.id);
        setSuccessMessage(response.message);
        return;
      }

      if (!nextStage) {
        return;
      }

      const updatedApplication = await apiRequest<ApplicationApiRecord>({
        path: `/applications/${application.id}/stage`,
        method: "PATCH",
        body: JSON.stringify({
          to_stage: nextStage,
          changed_by_id: user.id,
        }),
      });
      updateApplicationInState(updatedApplication);
      setSuccessMessage("Candidate was moved to the next pipeline stage.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to move candidate forward.");
    } finally {
      setBusyApplicationId(null);
      setBusyMessage(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    const application = applications.find((item) => String(item.id) === applicationId);

    if (!application) {
      return;
    }

    setBusyApplicationId(applicationId);
    setBusyMessage("Rejecting candidate...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureCurrentUser();
      const updatedApplication = await apiRequest<ApplicationApiRecord>({
        path: `/applications/${application.id}/reject`,
        method: "PATCH",
        body: JSON.stringify({
          rejected_stage: rejectionStageForApplication(application.stage),
          reason: "Rejected from the pipeline workspace.",
          changed_by_id: user.id,
        }),
      });
      updateApplicationInState(updatedApplication);
      setSuccessMessage("Candidate was moved to Rejected.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reject candidate.");
    } finally {
      setBusyApplicationId(null);
      setBusyMessage(null);
    }
  };

  const handleApprove = async (applicationId: string) => {
    const application = applications.find((item) => String(item.id) === applicationId);
    if (!application) {
      return;
    }

    const approvedStage = approvalStageForApplication(application.stage);
    if (!approvedStage) {
      await handleMoveForward(applicationId);
      return;
    }

    setBusyApplicationId(applicationId);
    setBusyMessage("Approving candidate...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureCurrentUser();
      const updatedApplication = await apiRequest<ApplicationApiRecord>({
        path: `/applications/${application.id}/stage`,
        method: "PATCH",
        body: JSON.stringify({
          to_stage: approvedStage,
          changed_by_id: user.id,
          notes: "Candidate approved explicitly from the pipeline workspace.",
        }),
      });
      updateApplicationInState(updatedApplication);
      setRejectionEmailSentIds((current) => current.filter((id) => id !== applicationId));
      setSuccessMessage("Candidate was approved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to approve candidate.");
    } finally {
      setBusyApplicationId(null);
      setBusyMessage(null);
    }
  };

  const handleScheduleMeeting = async (applicationId: string, scheduledAt: string) => {
    const application = applications.find((item) => String(item.id) === applicationId);

    if (!application || !scheduledAt) {
      return;
    }

    setBusyApplicationId(applicationId);
    setBusyMessage("Saving interview time...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureCurrentUser();
      await apiRequest({
        path: `/interviews/applications/${application.id}`,
        method: "POST",
        body: JSON.stringify({
          stage_type: "hr",
          scheduled_at: new Date(scheduledAt).toISOString(),
          interviewer_user_id: user.id,
        }),
      });
      await loadSingleApplication(application.id);
      setSuccessMessage("HR meeting was scheduled and the pipeline date was updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to schedule the HR meeting.");
    } finally {
      setBusyApplicationId(null);
      setBusyMessage(null);
    }
  };

  const handleMoveToStage = async (applicationId: string, targetStage: PipelineStage) => {
    const application = applications.find((item) => String(item.id) === applicationId);

    if (!application) {
      return;
    }

    const targetApplicationStage = targetApplicationStageForPipelineDrop(application, targetStage, role);
    if (!targetApplicationStage) {
      return;
    }

    if (targetStage === "rejected") {
      await handleReject(applicationId);
      return;
    }

    const interviewStageType = stageTypeForPipelineStage(targetStage);
    const existingInterviewAt =
      targetStage === "hr_interview_scheduled"
        ? application.hr_interview_at
        : targetStage === "technical_interview_scheduled"
          ? application.technical_interview_at
          : targetStage === "management_interview_scheduled"
            ? application.management_interview_at
            : null;

    if (interviewStageType && !existingInterviewAt) {
      setBusyApplicationId(applicationId);
      setBusyMessage("Scheduling the next interview step...");
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const user = await ensureCurrentUser();
        await apiRequest({
          path: `/interviews/applications/${application.id}`,
          method: "POST",
          body: JSON.stringify({
            stage_type: interviewStageType,
            scheduled_at: defaultInterviewDateTimeLocal(),
            interviewer_user_id: user.id,
          }),
        });
        await loadSingleApplication(application.id);
        setSuccessMessage("Candidate was moved and a default interview time was created.");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to move candidate.");
      } finally {
        setBusyApplicationId(null);
        setBusyMessage(null);
      }
      return;
    }

    setBusyApplicationId(applicationId);
    setBusyMessage("Moving candidate to the selected stage...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureCurrentUser();
      const updatedApplication = await apiRequest<ApplicationApiRecord>({
        path: `/applications/${application.id}/stage`,
        method: "PATCH",
        body: JSON.stringify({
          to_stage: targetApplicationStage,
          changed_by_id: user.id,
        }),
      });
      updateApplicationInState(updatedApplication);
      setSuccessMessage("Candidate was moved to the selected pipeline stage.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to move candidate.");
    } finally {
      setBusyApplicationId(null);
      setBusyMessage(null);
    }
  };

  const handleSendStageEmail = async (
    applicationId: string,
    emailType:
      | "hr_invite"
      | "hr_passed"
      | "hr_rejection"
      | "technical_passed"
      | "technical_rejection"
      | "management_rejection"
      | "offer_sent",
    templateVariant?: "technical_interview_invite" | "hr_interview_rejection",
  ) => {
    const application = applications.find((item) => String(item.id) === applicationId);
    if (!application) {
      return;
    }

    setBusyApplicationId(applicationId);
    setBusyMessage(
      emailType === "hr_passed"
        ? templateVariant === "technical_interview_invite"
          ? "Sending technical interview invitation..."
          : "Sending approval email..."
        : emailType === "technical_passed"
          ? "Sending management-stage email..."
          : emailType === "offer_sent"
            ? "Sending onboarding email..."
            : emailType === "management_rejection"
              ? "Sending management rejection email..."
              : emailType === "technical_rejection"
                ? "Sending technical rejection email..."
                : emailType === "hr_rejection"
                  ? templateVariant === "hr_interview_rejection"
                    ? "Sending post-interview rejection email..."
                    : "Sending rejection email..."
                  : "Sending candidate email...",
    );
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await ensureCurrentUser();
      const response = await apiRequest<{ message: string }>({
        path: `/applications/${application.id}/send-email`,
        method: "POST",
        body: JSON.stringify({
          sent_by_id: user.id,
          email_type: emailType,
          allow_resend: emailType !== "hr_invite",
          template_variant: templateVariant,
        }),
      });
      if (
        emailType === "hr_rejection" ||
        emailType === "technical_rejection" ||
        emailType === "management_rejection"
      ) {
        setRejectionEmailSentIds((current) => [...new Set([...current, applicationId])]);
      }
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to queue the candidate email.");
    } finally {
      setBusyApplicationId(null);
      setBusyMessage(null);
    }
  };

  const handleDeleteFromPipeline = async (applicationId: string) => {
    const application = applications.find((item) => String(item.id) === applicationId);
    if (!application) {
      return;
    }

    setBusyApplicationId(applicationId);
    setBusyMessage("Removing candidate from the pipeline...");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest({
        path: `/applications/${application.id}`,
        method: "DELETE",
      });
      startTransition(() => {
        setApplications((current) => current.filter((item) => item.id !== application.id));
      });
      setSuccessMessage("Candidate was removed from the pipeline. The candidate profile was kept in the database.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove candidate from the pipeline.");
    } finally {
      setBusyApplicationId(null);
      setBusyMessage(null);
    }
  };

  return (
    <div className="-mx-5 min-h-[calc(100vh-122px)] bg-[#051424] lg:-mx-10 xl:-mx-12">
      <div className="mx-auto max-w-[1680px] space-y-8 px-5 py-8 lg:px-10 xl:px-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-['Hanken_Grotesk'] text-[2.75rem] font-semibold tracking-[-0.04em] text-[#d4e4fa]">
              {content.title}
            </h1>
            <div className="mt-4 flex items-center gap-4 text-[1rem] text-[#bbc9cd]">
              <span>Vacancy:</span>
              <div className="relative">
                <select
                  value={selectedVacancyId}
                  onChange={(event) => setSelectedVacancyId(event.target.value)}
                  className="h-11 min-w-[232px] appearance-none rounded-lg border border-[#3c494c] bg-[#122131] px-4 pr-10 text-[1rem] font-medium text-[#d4e4fa] outline-none transition focus:border-[#8aebff] focus:ring-1 focus:ring-[#8aebff]"
                >
                  <option value="all">All vacancies</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy.id} value={vacancy.id}>
                      {vacancy.title}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#859397]">⌄</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <p className="max-w-xs text-right text-[1rem] italic text-[#bbc9cd]/70">{content.description}</p>
            <div className="relative flex items-center gap-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#859397]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search candidates..."
                className="w-64 rounded-lg border border-[#3c494c] bg-[#010f1f] py-2 pl-10 pr-4 text-[1rem] text-[#d4e4fa] outline-none transition focus:border-[#8aebff] focus:ring-1 focus:ring-[#8aebff] placeholder:text-[#859397]"
              />
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-[#93000a]/30 bg-[#2b171c] px-4 py-3 text-sm text-[#ffb4ab]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-900/20 px-4 py-3 text-sm text-green-400">
            <span className="text-lg">◉</span>
            {successMessage}
          </div>
        ) : null}

        {busyMessage ? (
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#10161c] px-4 py-3 text-sm text-white/82">
            <LoaderCircle className="h-4 w-4 animate-spin text-[#63e7ff]" />
            <span>{busyMessage}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[18px] border border-white/10 bg-[#10161c] px-4 py-5 text-sm text-[#8fa2b5]">
            Loading pipeline...
          </div>
        ) : (
          <PipelineBoard
            candidates={filteredCandidates}
            visibleStages={visibleStages}
            role={role}
            onMoveForward={handleMoveForward}
            onApprove={handleApprove}
            onMoveToStage={handleMoveToStage}
            onReject={handleReject}
            onScheduleMeeting={handleScheduleMeeting}
            onSendStageEmail={handleSendStageEmail}
            onDeleteFromPipeline={handleDeleteFromPipeline}
            busyApplicationId={busyApplicationId}
          />
        )}

        {busyApplicationId ? <p className="text-sm text-[#8fa2b5]">Please wait while the app processes this action.</p> : null}
      </div>
    </div>
  );
}
