import { FileUp, Sparkles } from "lucide-react";

import { publicApplyVacancy } from "@/lib/mock-data";

export function ApplyPrototype() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[#7f94a8]">Candidate experience</p>
        <h2 className="mt-3 text-[2.1rem] font-semibold tracking-[-0.04em] text-white">{publicApplyVacancy.title}</h2>
        <p className="mt-3 text-sm text-[#a9bbc9]">
          {publicApplyVacancy.location} · {publicApplyVacancy.employmentType}
        </p>
        <div className="mt-6 rounded-[24px] border border-white/10 bg-[#0d141c] p-6">
          <h3 className="text-lg font-semibold text-white">What this role is about</h3>
          <div className="mt-4 space-y-4 text-sm leading-7 text-[#b7c8d5]">
            {publicApplyVacancy.overview.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b8e6ff] text-[#081018]">
            <FileUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#7f94a8]">Prototype form</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Upload your resume</h3>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#d7e3ec]">Resume PDF</label>
            <div className="rounded-[22px] border border-white/10 bg-[#0d141c] px-4 py-4 text-sm text-[#90a2b5]">
              Choose file...
            </div>
          </div>

          <div className="rounded-[22px] border border-[#36556c] bg-[#152531] px-4 py-4 text-sm text-[#dce8f2]">
            This is a design-only flow. No file is uploaded in the sandbox.
          </div>

          <button className="inline-flex items-center gap-2 rounded-full bg-[#b8e6ff] px-5 py-3 text-sm font-semibold text-[#081018]">
            <Sparkles className="h-4 w-4" />
            Submit prototype application
          </button>
        </div>
      </section>
    </div>
  );
}
