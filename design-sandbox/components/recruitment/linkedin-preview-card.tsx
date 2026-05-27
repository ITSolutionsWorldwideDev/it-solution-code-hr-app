"use client";

import { useState } from "react";
import { ExternalLink, Linkedin, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import type { LinkedInPreviewApiRecord } from "@/lib/recruitment-types";

type LinkedInPreviewCardProps = {
  vacancyId: string;
};

function isLocalDevHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeLocalApplyUrl(applyUrl: string) {
  if (typeof window === "undefined") {
    return applyUrl;
  }

  try {
    const parsedUrl = new URL(applyUrl);
    const currentUrl = new URL(window.location.origin);

    if (!isLocalDevHost(parsedUrl.hostname) || !isLocalDevHost(currentUrl.hostname)) {
      return applyUrl;
    }

    parsedUrl.protocol = currentUrl.protocol;
    parsedUrl.hostname = currentUrl.hostname;
    parsedUrl.port = currentUrl.port;
    return parsedUrl.toString();
  } catch {
    return applyUrl;
  }
}

function normalizeLocalPostText(postText: string, originalApplyUrl: string, normalizedApplyUrl: string) {
  if (originalApplyUrl === normalizedApplyUrl) {
    return postText;
  }

  return postText.replaceAll(originalApplyUrl, normalizedApplyUrl);
}

export function LinkedInPreviewCard({ vacancyId }: LinkedInPreviewCardProps) {
  const [preview, setPreview] = useState<LinkedInPreviewApiRecord | null>(null);
  const [loadingAction, setLoadingAction] = useState<"preview" | "publish" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLinkedInAction = async (dryRun: boolean) => {
    setLoadingAction(dryRun ? "preview" : "publish");
    setErrorMessage(null);
    setPreview(null);

    try {
      const response = await apiRequest<LinkedInPreviewApiRecord>({
        path: "/integrations/n8n/linkedin-preview",
        method: "POST",
        body: JSON.stringify({
          vacancy_id: Number(vacancyId),
          dry_run: dryRun,
        }),
      });

      const applyUrl = normalizeLocalApplyUrl(response.apply_url);

      setPreview({
        ...response,
        success: response.success === true || String(response.success).toLowerCase() === "true",
        dry_run: response.dry_run === true || String(response.dry_run).toLowerCase() === "true",
        apply_url: applyUrl,
        post_text: normalizeLocalPostText(response.post_text, response.apply_url, applyUrl),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to process the LinkedIn action."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7f93a5]">
            LinkedIn Preview
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Prepare post text</h2>
          <p className="mt-2 text-sm leading-6 text-[#95a8b8]">
            Generate a dry-run LinkedIn post preview for this vacancy before we wire it into the app publishing flow.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleLinkedInAction(true)}
            disabled={loadingAction !== null}
            icon={Linkedin}
          >
            {loadingAction === "preview" ? "Generating..." : "Preview LinkedIn Post"}
          </Button>

          <Button
            type="button"
            onClick={() => handleLinkedInAction(false)}
            disabled={loadingAction !== null}
            icon={Send}
          >
            {loadingAction === "publish" ? "Publishing..." : "Publish to LinkedIn"}
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-[18px] border border-[#b85b68]/35 bg-[rgba(184,91,104,0.12)] px-4 py-3 text-sm text-[#f0b6bf]">
          {errorMessage}
        </div>
      ) : null}

      {preview ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[20px] border border-[#7eb9df]/16 bg-[#466d8a]/10 px-4 py-3 text-sm text-[#dbe8f2]">
            <p className="font-semibold text-white">{preview.message}</p>
            <p className="mt-1 text-[#bcd3e4]">Dry run: {preview.dry_run ? "Yes" : "No"}</p>
          </div>

          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">Post text</p>
            <p className="mt-4 whitespace-pre-wrap text-[1rem] leading-8 text-[#d6e1ea]">{preview.post_text}</p>
          </div>

          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">Apply URL</p>
            <a
              href={preview.apply_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#9fc6e0] hover:text-white"
            >
              {preview.apply_url}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
