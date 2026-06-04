"use client";

import { Globe, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import type { VacancyRecord, WebsitePublishApiRecord } from "@/lib/recruitment-types";

type WebsitePublishCardProps = {
  vacancyId: string;
  vacancy: VacancyRecord;
};

const fieldLabels: Record<string, string> = {
  title: "Title",
  content: "Content",
  location: "Location",
  type: "Employment Type",
  pdf_url: "PDF URL",
  published: "Published",
  created_by: "Created By",
};

function formatMappedValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

export function WebsitePublishCard({ vacancyId, vacancy }: WebsitePublishCardProps) {
  const [result, setResult] = useState<WebsitePublishApiRecord | null>(null);
  const [loadingAction, setLoadingAction] = useState<"preview" | "publish" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePreview = async () => {
    setLoadingAction("preview");
    setErrorMessage(null);

    try {
      const response = await apiRequest<WebsitePublishApiRecord>({
        path: "/integrations/website/preview",
        method: "POST",
        body: JSON.stringify({
          vacancy_id: Number(vacancyId),
        }),
      });
      setResult(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate website publish preview.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePublish = async () => {
    setLoadingAction("publish");
    setErrorMessage(null);

    try {
      const response = await apiRequest<WebsitePublishApiRecord>({
        path: "/integrations/website/publish",
        method: "POST",
        body: JSON.stringify({
          vacancy_id: Number(vacancyId),
        }),
      });
      setResult(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to publish vacancy to website.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
            Website Publish
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Publish vacancy to website</h2>
          <p className="mt-2 text-sm leading-6 text-[#95a8b8]">
            Push <span className="font-semibold text-white">{vacancy.title}</span> into the website job listing table.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePreview}
            disabled={loadingAction !== null}
            icon={Globe}
          >
            {loadingAction === "preview" ? "Generating..." : "Preview Website Payload"}
          </Button>

          <Button
            type="button"
            onClick={handlePublish}
            disabled={loadingAction !== null}
            icon={Send}
          >
            {loadingAction === "publish" ? "Publishing..." : "Publish to Website"}
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-[18px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-4 py-3 text-sm text-[#f0b6bf]">
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[20px] border border-[#7eb9df]/16 bg-[#466d8a]/10 px-4 py-3 text-sm text-[#dbe8f2]">
            <p className="font-semibold text-white">{result.message}</p>
            <p className="mt-1 text-[#bcd3e4]">Action: {result.action}</p>
            <p className="mt-1 text-[#bcd3e4]">Published: {result.published ? "Yes" : "No"}</p>
            <p className="mt-1 text-[#bcd3e4]">Job info id: {result.job_info_id ?? "Not created yet"}</p>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#0f1319]">
            <div className="border-b border-white/8 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">
                Website mapped fields
              </p>
            </div>

            <div className="divide-y divide-white/8">
              {Object.entries(result.mapped_fields).map(([key, value]) => (
                <div key={key} className="grid gap-2 px-5 py-4 md:grid-cols-[140px_minmax(0,1fr)]">
                  <p className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[#7f93aa]">
                    {fieldLabels[key] ?? key}
                  </p>
                  <p className="text-sm leading-7 text-[#eef5fb]">{formatMappedValue(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
