import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CandidateDetail } from "@/components/recruitment/candidate-detail";
import { mapApplicationToPipelineCandidate, pipelineStageLabels } from "@/lib/pipeline";
import type { ApplicationApiRecord, CandidateApiRecord, VacancyApiRecord } from "@/lib/recruitment-types";

type PipelineCandidateDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PipelineCandidateDetailPage({
  params,
}: PipelineCandidateDetailPageProps) {
  const { id } = await params;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

  const applicationResponse = await fetch(`${apiBaseUrl}/applications/${id}`, {
    cache: "no-store",
  });

  if (!applicationResponse.ok) {
    notFound();
  }

  const application = (await applicationResponse.json()) as ApplicationApiRecord;
  const [candidateResponse, vacancyResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/candidates/${application.candidate_id}`, { cache: "no-store" }),
    fetch(`${apiBaseUrl}/vacancies/${application.vacancy_id}`, { cache: "no-store" }),
  ]);

  if (!candidateResponse.ok || !vacancyResponse.ok) {
    notFound();
  }

  const candidateRecord = (await candidateResponse.json()) as CandidateApiRecord;
  const vacancyRecord = (await vacancyResponse.json()) as VacancyApiRecord;
  const candidate = mapApplicationToPipelineCandidate(application, candidateRecord, vacancyRecord);

  if (!candidate) {
    notFound();
  }

  return (
    <DashboardShell>
      <CandidateDetail
        candidate={candidate}
        stageLabel={pipelineStageLabels[candidate.stage]}
      />
    </DashboardShell>
  );
}
