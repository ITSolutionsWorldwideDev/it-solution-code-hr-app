"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import type { CandidateMatchApiRecord } from "@/lib/recruitment-types";
import { Panel } from "@/components/ui/panel";

type VacancyMatchesPanelProps = {
  vacancyId: string;
};

function getApiVacancyId(vacancyId: string) {
  const numericPart = vacancyId.match(/\d+/)?.[0];
  return numericPart ?? vacancyId;
}

export function VacancyMatchesPanel({ vacancyId }: VacancyMatchesPanelProps) {
  const [matches, setMatches] = useState<CandidateMatchApiRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadMatches = async () => {
      try {
        const response = await apiRequest<CandidateMatchApiRecord[]>({
          path: `/vacancies/${getApiVacancyId(vacancyId)}/matches`,
        });
        setMatches(response);
      } catch (error) {
        setMatches([]);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load vacancy matches.");
      }
    };

    void loadMatches();
  }, [vacancyId]);

  return (
    <Panel className="rounded-[30px] p-6">
      <h2 className="text-lg font-semibold text-white">Top ranked candidates</h2>
      <p className="mt-2 text-sm text-[#95a8b8]">
        Live vacancy rankings from the backend candidate match table.
      </p>

      {errorMessage ? (
        <div className="mt-4 rounded-[18px] border border-[#f0d5d7] bg-[#fff7f8] px-4 py-3 text-sm text-[#a65765]">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {matches.length > 0 ? (
          matches.map((match) => (
            <div
              key={match.id}
            className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">
                  {match.candidate_name ?? `Candidate #${match.candidate_id}`}
                </p>
                <p className="mt-1 text-sm text-[#95a8b8]">{match.ai_summary}</p>
              </div>
                <div className="rounded-full bg-[#466d8a]/18 px-3 py-1 text-sm font-semibold text-[#9fc6e0]">
                  {match.match_score}%
                </div>
              </div>
              <p className="mt-3 text-sm text-[#95a8b8]">{match.fit_explanation}</p>
            </div>
          ))
        ) : (
          <div className="rounded-[20px] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm text-[#95a8b8]">
            No ranked candidates found for this vacancy yet.
          </div>
        )}
      </div>
    </Panel>
  );
}
