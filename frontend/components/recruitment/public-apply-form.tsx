"use client";

import { useState } from "react";
import { FileUp, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import type { PublicApplicationSubmitResponse } from "@/lib/recruitment-types";

type PublicApplyFormProps = {
  vacancy: {
    id: number;
    title: string;
  };
  compact?: boolean;
};

export function PublicApplyForm({ vacancy, compact = false }: PublicApplyFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [location, setLocation] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!file) {
      setErrorMessage("Choose a resume file first.");
      return;
    }

    if (!candidateEmail.trim()) {
      setErrorMessage("Enter your email address so we can contact you.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vacancy_id", String(vacancy.id));
      formData.append("candidate_email", candidateEmail.trim());
      if (location.trim()) {
        formData.append("location", location.trim());
      }
      if (workAuthorization.trim()) {
        formData.append("work_authorization", workAuthorization.trim());
      }
      if (noticePeriod.trim()) {
        formData.append("notice_period", noticePeriod.trim());
      }

      const response = await apiRequest<PublicApplicationSubmitResponse>({
        path: "/applications/public-submit",
        method: "POST",
        body: formData,
      });

      setSuccessMessage(`${response.message} Parse status: ${response.parse_status}.`);
      setFile(null);
      setCandidateEmail("");
      setLocation("");
      setWorkAuthorization("");
      setNoticePeriod("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Resume upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div>
        <h2 className="text-[1.45rem] font-semibold text-white">Upload your resume</h2>
        <p className="mt-2 text-sm leading-6 text-[#9eb0bf]">
          Apply for <span className="font-semibold text-white">{vacancy.title}</span> by sharing your resume and a
          few quick details.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#9ab0c3]">
            Email Address
          </label>
          <Input
            type="email"
            value={candidateEmail}
            onChange={(event) => setCandidateEmail(event.target.value)}
            placeholder="your.name@example.com"
            className="h-11 rounded-[14px] border-white/10 bg-white/[0.05] text-[#f5f7fa] placeholder:text-[#6f8293]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#9ab0c3]">
            Resume
          </label>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-white/14 bg-[#11151b] px-5 py-8 text-center transition hover:border-[#9db8ff]/35">
            <FileUp className="h-5 w-5 text-[#a9c3ff]" />
            <span className="mt-3 text-sm font-medium text-[#d9e5ee]">
              {file ? file.name : "Click to upload or drag and drop"}
            </span>
            <span className="mt-2 text-xs text-[#7f93a5]">PDF, DOCX, or DOC</span>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <div>
          <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#9ab0c3]">
            Location
          </label>
          <Input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="City, Country"
            className="h-11 rounded-[14px] border-white/10 bg-white/[0.05] text-[#f5f7fa] placeholder:text-[#6f8293]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#9ab0c3]">
            Work Authorization
          </label>
          <Input
            type="text"
            value={workAuthorization}
            onChange={(event) => setWorkAuthorization(event.target.value)}
            placeholder="Select status"
            className="h-11 rounded-[14px] border-white/10 bg-white/[0.05] text-[#f5f7fa] placeholder:text-[#6f8293]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#9ab0c3]">
            Notice Period
          </label>
          <Input
            type="text"
            value={noticePeriod}
            onChange={(event) => setNoticePeriod(event.target.value)}
            placeholder="Select duration"
            className="h-11 rounded-[14px] border-white/10 bg-white/[0.05] text-[#f5f7fa] placeholder:text-[#6f8293]"
          />
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
          disabled={!file || !candidateEmail.trim() || isSubmitting}
          icon={isSubmitting ? LoaderCircle : FileUp}
          className={`w-full justify-center rounded-[14px] bg-[#adc2ff] px-4 py-3 text-[#0d1420] shadow-none hover:bg-[#bfd0ff] ${
            isSubmitting ? "opacity-80" : ""
          }`}
        >
          {isSubmitting ? "Uploading..." : "Submit Resume"}
        </Button>

        {compact ? (
          <p className="text-center text-xs leading-5 text-[#7f93a5]">
            By submitting, you agree to our recruitment privacy policy and data processing terms.
          </p>
        ) : null}
      </div>
    </div>
  );
}
