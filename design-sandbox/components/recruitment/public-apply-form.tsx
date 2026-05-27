"use client";

import { useState } from "react";
import { FileUp, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import type { CandidateQueueParseJobResponse, VacancyApiRecord } from "@/lib/recruitment-types";

type PublicApplyFormProps = {
  vacancy: VacancyApiRecord;
};

export function PublicApplyForm({ vacancy }: PublicApplyFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!file) {
      setErrorMessage("Choose a PDF resume first.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vacancy_id", String(vacancy.id));
      formData.append("uploaded_by", "public_apply_page");

      const response = await apiRequest<CandidateQueueParseJobResponse>({
        path: "/candidates/queue-parse-cv",
        method: "POST",
        body: formData,
      });

      setSuccessMessage(
        `Your resume was uploaded successfully. Parse job #${response.parse_job_id} is now queued for this vacancy.`,
      );
      setFile(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Resume upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#8fa9be]">
          Apply Now
        </p>
        <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-white">
          Upload your resume
        </h2>
        <p className="mt-3 max-w-2xl text-[1rem] leading-7 text-[#bfd0dd]">
          Apply for <span className="font-semibold text-white">{vacancy.title}</span>. We currently accept PDF
          resumes and queue them directly for parsing inside our recruitment workspace.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-[#dce7ef]">Resume PDF</label>
          <Input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="border-white/10 bg-white/[0.04] text-[#f5f7fa] file:text-[#dce7ef]"
          />
          <p className="mt-2 text-sm text-[#9cb2c4]">
            {file ? `${file.name} selected` : "Choose a PDF file to continue."}
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-[18px] border border-[#6f2a36] bg-[#2b1418] px-4 py-3 text-sm text-[#ffb6c0]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-[18px] border border-[#27553e] bg-[#12261c] px-4 py-3 text-sm text-[#8fe0b2]">
            {successMessage}
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!file || isSubmitting}
          icon={isSubmitting ? LoaderCircle : FileUp}
          className={isSubmitting ? "opacity-80" : ""}
        >
          {isSubmitting ? "Uploading..." : "Submit Resume"}
        </Button>
      </div>
    </div>
  );
}
