import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CandidateUploadPanel } from "@/components/recruitment/candidate-upload-panel";

export default function CandidatesPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white">
            Candidates
          </h1>
          <p className="mt-3 text-[1.05rem] text-[#95a8b8]">
            Upload resumes, parse candidate data with OpenAI, and inspect vacancy-based rankings and role suggestions.
          </p>
        </div>

        <CandidateUploadPanel />
      </div>
    </DashboardShell>
  );
}
