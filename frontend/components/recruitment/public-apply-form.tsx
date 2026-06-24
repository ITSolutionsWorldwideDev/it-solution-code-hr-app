"use client";

import { useState } from "react";
import { FileUp, LoaderCircle, Send } from "lucide-react";

import { apiRequest } from "@/lib/api/client";
import type { PublicApplicationSubmitResponse } from "@/lib/recruitment-types";

type PublicApplyFormProps = {
  vacancy: {
    id: number;
    title: string;
  };
  compact?: boolean;
};

const workAuthorizationOptions = [
  "Requires Visa Sponsorship",
  "Authorized to work in the EU",
  "Authorized to work in the Netherlands",
  "Student Visa",
];

const noticePeriodOptions = ["Immediate", "1 Month", "2 Months", "3 Months"];

export function PublicApplyForm({ vacancy, compact = false }: PublicApplyFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [location, setLocation] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState(workAuthorizationOptions[0]);
  const [noticePeriod, setNoticePeriod] = useState(noticePeriodOptions[0]);
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
      setWorkAuthorization(workAuthorizationOptions[0]);
      setNoticePeriod(noticePeriodOptions[0]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Resume upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[rgba(30,41,59,0.4)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#8aebff]/10 blur-3xl" />

      <div className="relative">
        <h2 className="font-['Hanken_Grotesk'] text-[2rem] font-semibold text-white">Upload your resume</h2>
        <p className="mt-2 text-sm leading-7 text-[#bbc9cd]">
          Apply for <span className="font-medium text-[#8aebff]">{vacancy.title}</span> by sharing your details.
        </p>
      </div>

      <div className="relative mt-6 space-y-4">
        <FieldLabel>Email Address</FieldLabel>
        <input
          type="email"
          value={candidateEmail}
          onChange={(event) => setCandidateEmail(event.target.value)}
          placeholder="your.name@example.com"
          className="h-12 w-full rounded-lg border border-[#3c494c] bg-[#273647] px-4 text-[#d4e4fa] outline-none transition placeholder:text-[#859397] focus:border-[#8aebff] focus:shadow-[0_0_0_1px_#8aebff,0_0_12px_rgba(138,235,255,0.2)]"
        />

        <div>
          <FieldLabel>Resume</FieldLabel>
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#3c494c] bg-[#122131]/50 px-5 py-8 text-center transition hover:border-[#8aebff]/50">
            <FileUp className="h-8 w-8 text-[#859397]" />
            <p className="mt-3 text-sm text-[#d4e4fa]">
              <span className="font-medium text-[#8aebff]">{file ? file.name : "Click to upload"}</span>
              {!file ? " or drag and drop" : ""}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#859397]">
              PDF, DOCX, or DOC (Max 5MB)
            </p>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Location</FieldLabel>
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City, Country"
              className="mt-2 h-12 w-full rounded-lg border border-[#3c494c] bg-[#273647] px-4 text-[#d4e4fa] outline-none transition placeholder:text-[#859397] focus:border-[#8aebff]"
            />
          </div>
          <div>
            <FieldLabel>Notice Period</FieldLabel>
            <select
              value={noticePeriod}
              onChange={(event) => setNoticePeriod(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-[#3c494c] bg-[#273647] px-4 text-[#d4e4fa] outline-none transition focus:border-[#8aebff]"
            >
              {noticePeriodOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <FieldLabel>Work Authorization</FieldLabel>
          <select
            value={workAuthorization}
            onChange={(event) => setWorkAuthorization(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-[#3c494c] bg-[#273647] px-4 text-[#d4e4fa] outline-none transition focus:border-[#8aebff]"
          >
            {workAuthorizationOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-[#93000a] bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffdad6]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-lg border border-[#27553e] bg-[#12261c] px-4 py-3 text-sm text-[#8fe0b2]">
            {successMessage}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!file || !candidateEmail.trim() || isSubmitting}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#8aebff] px-4 font-semibold text-[#001f25] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isSubmitting ? "Submitting..." : "Submit Application"}
        </button>

        {compact ? (
          <p className="px-4 text-center text-[11px] leading-5 text-[#859397]">
            By submitting, you agree to our recruitment privacy policy and data processing terms.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <label className="font-mono text-[12px] uppercase tracking-[0.12em] text-[#bbc9cd]">{children}</label>;
}
