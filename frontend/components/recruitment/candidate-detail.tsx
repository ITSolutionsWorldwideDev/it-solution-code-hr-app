import { FileText } from "lucide-react";

import type { PipelineCandidateRecord } from "@/lib/recruitment-types";

import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";

type CandidateDetailProps = {
  candidate: PipelineCandidateRecord;
  stageLabel: string;
};

export function CandidateDetail({ candidate, stageLabel }: CandidateDetailProps) {
  const pros = candidate.parsedData.pros ?? [];
  const cons = candidate.parsedData.cons ?? [];

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
      <Panel className="rounded-[30px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8ea2b3]">
              Candidate Profile
            </p>
            <h1 className="mt-3 text-[2.35rem] font-semibold tracking-[-0.04em] text-white">
              {candidate.name}
            </h1>
            <p className="mt-2 text-[1.05rem] text-[#95a8b8]">{candidate.role}</p>
          </div>

          <div className="space-y-3">
            <div className="text-right text-[2rem] font-semibold text-[#9fc6e0]">
              {candidate.matchScore}%
            </div>
            <StatusPill status={stageLabel} tone="blue" />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-[#9ab0c0]">AI Match Score</p>
            <p className="mt-2 text-[1rem] text-[#edf4fa]">{candidate.matchScore}%</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-[#9ab0c0]">Experience</p>
            <p className="mt-2 text-[1rem] text-[#edf4fa]">
              {candidate.parsedData.experienceYears ? `${candidate.parsedData.experienceYears} years` : "Not specified"}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-[#9ab0c0]">Email</p>
            <p className="mt-2 text-[1rem] text-[#edf4fa]">{candidate.parsedData.email}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-[#9ab0c0]">Phone</p>
            <p className="mt-2 text-[1rem] text-[#edf4fa]">{candidate.parsedData.phone}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-[#9ab0c0]">Location</p>
            <p className="mt-2 text-[1rem] text-[#edf4fa]">{candidate.parsedData.location ?? "Not provided"}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-[#9ab0c0]">Work Authorization</p>
            <p className="mt-2 text-[1rem] text-[#edf4fa]">
              {candidate.parsedData.workAuthorization ?? "Not provided"}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5 md:col-span-2">
            <p className="text-sm font-semibold text-[#9ab0c0]">Notice Period</p>
            <p className="mt-2 text-[1rem] text-[#edf4fa]">{candidate.parsedData.noticePeriod ?? "Not provided"}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5 md:col-span-2">
            <p className="text-sm font-semibold text-[#9ab0c0]">AI Screening Summary</p>
            <p className="mt-3 text-[1rem] leading-7 text-[#95a8b8]">
              {candidate.parsedData.executiveSummary ?? candidate.aiSummary}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5 md:col-span-2">
            <p className="text-sm font-semibold text-[#9ab0c0]">Why This Candidate Matches</p>
            <p className="mt-3 text-[1rem] leading-7 text-[#95a8b8]">
              {candidate.parsedData.fitExplanation ?? "No fit explanation is available yet."}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-[#9ab0c0]">Top Strengths</p>
            {pros.length > 0 ? (
              <ul className="mt-3 space-y-2 text-[1rem] leading-7 text-[#95a8b8]">
                {pros.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[1rem] leading-7 text-[#95a8b8]">No strengths were stored yet.</p>
            )}
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
            <p className="text-sm font-semibold text-[#9ab0c0]">Attention Points</p>
            {cons.length > 0 ? (
              <ul className="mt-3 space-y-2 text-[1rem] leading-7 text-[#95a8b8]">
                {cons.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[1rem] leading-7 text-[#95a8b8]">No critical gaps were flagged.</p>
            )}
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5 md:col-span-2">
            <p className="text-sm font-semibold text-[#9ab0c0]">Experience</p>
            <p className="mt-3 text-[1rem] leading-7 text-[#95a8b8]">
              {candidate.parsedData.experience}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5 md:col-span-2">
            <p className="text-sm font-semibold text-[#9ab0c0]">Education</p>
            <p className="mt-3 text-[1rem] leading-7 text-[#95a8b8]">
              {candidate.parsedData.education}
            </p>
          </div>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel className="rounded-[30px] p-6">
          <h2 className="text-[1.15rem] font-semibold text-white">Parsed Data</h2>
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-[#9ab0c0]">Skills</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {candidate.parsedData.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-[#9fc6e0]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="rounded-[30px] p-6">
          <h2 className="text-[1.15rem] font-semibold text-white">CV Reference</h2>
          <a
            href="#"
            className="mt-4 inline-flex items-center gap-2 rounded-[18px] bg-[#466d8a]/18 px-4 py-3 text-sm font-semibold text-[#9fc6e0]"
          >
            <FileText className="h-4 w-4" />
            {candidate.cvReference}
          </a>
          <p className="mt-4 text-sm leading-6 text-[#95a8b8]">
            This placeholder reference is ready to be connected to the FastAPI file upload and document retrieval flow.
          </p>
        </Panel>
      </div>
    </div>
  );
}
