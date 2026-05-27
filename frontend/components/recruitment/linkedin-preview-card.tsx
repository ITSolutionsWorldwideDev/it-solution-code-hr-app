"use client";

import { useState } from "react";
import { Linkedin, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/client";
import type { LinkedInPreviewApiRecord, VacancyRecord } from "@/lib/recruitment-types";

type LinkedInPreviewCardProps = {
  vacancyId: string;
  vacancy: VacancyRecord;
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
  let nextText = postText;

  if (originalApplyUrl !== normalizedApplyUrl) {
    nextText = nextText.replaceAll(originalApplyUrl, normalizedApplyUrl);
  }

  return nextText.trim();
}

function ensureApplyUrlInPostText(postText: string, applyUrl: string) {
  const cleanedPost = postText.trim();

  if (!cleanedPost) {
    return `How to Apply\nApply here:\n${applyUrl}`;
  }

  if (cleanedPost.includes(applyUrl)) {
    return cleanedPost;
  }

  const placeholderPattern = /\[PLAK HIER JE URL\]/gi;
  if (placeholderPattern.test(cleanedPost)) {
    return cleanedPost.replace(placeholderPattern, applyUrl).trim();
  }

  const howToApplyPattern = /(How to Apply\s*\n(?:.*\n?)*)/i;
  const match = cleanedPost.match(howToApplyPattern);

  if (match?.[1]) {
    const section = match[1].trimEnd();
    return cleanedPost.replace(section, `${section}\n\nApply here:\n${applyUrl}`).trim();
  }

  return `${cleanedPost}\n\nHow to Apply\nApply here:\n${applyUrl}`.trim();
}

function renderLinkedInPreviewText(postText: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const lines = postText.split("\n");

  return lines.map((line, lineIndex) => {
    const parts = line.split(urlPattern);

    return (
      <span key={`line-${lineIndex}`}>
        {parts.map((part, partIndex) => {
          if (urlPattern.test(part)) {
            return (
              <a
                key={`part-${lineIndex}-${partIndex}`}
                href={part}
                target="_blank"
                rel="noreferrer"
                className="text-[#9fd0ff] underline underline-offset-4 transition hover:text-white"
              >
                {part}
              </a>
            );
          }

          return <span key={`part-${lineIndex}-${partIndex}`}>{part}</span>;
        })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

export function LinkedInPreviewCard({ vacancyId, vacancy }: LinkedInPreviewCardProps) {
  const [preview, setPreview] = useState<LinkedInPreviewApiRecord | null>(null);
  const [loadingAction, setLoadingAction] = useState<"preview" | "publish" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buildLocalPreview = () => {
    const applyUrl =
      typeof window === "undefined"
        ? `/apply/${vacancyId}`
        : new URL(`/apply/${vacancyId}`, window.location.origin).toString();
    const postText = ensureApplyUrlInPostText(vacancy.description, applyUrl);

    setPreview({
      success: true,
      dry_run: true,
      message: "LinkedIn preview generated.",
      post_text: postText,
      apply_url: applyUrl,
    });
  };

  const handlePreview = () => {
    setLoadingAction("preview");
    setErrorMessage(null);
    buildLocalPreview();
    setLoadingAction(null);
  };

  const handlePublish = async () => {
    setLoadingAction("publish");
    setErrorMessage(null);
    setPreview(null);

    try {
      const response = await apiRequest<LinkedInPreviewApiRecord>({
        path: "/integrations/n8n/linkedin-preview",
        method: "POST",
        body: JSON.stringify({
          vacancy_id: Number(vacancyId),
          dry_run: false,
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
          <h2 className="mt-2 text-lg font-semibold text-white">Preview exact LinkedIn post</h2>
          <p className="mt-2 text-sm leading-6 text-[#95a8b8]">
            Preview the exact text content that will be sent to LinkedIn, including the external apply link.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={handlePreview}
            disabled={loadingAction !== null}
            icon={Linkedin}
          >
            {loadingAction === "preview" ? "Generating..." : "Preview LinkedIn Post"}
          </Button>

          <Button
            type="button"
            onClick={handlePublish}
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

          <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#0f1319]">
            <div className="border-b border-white/8 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f93aa]">
                LinkedIn post preview
              </p>
            </div>

            <div className="space-y-6 px-5 py-5">
              <div className="space-y-3">
                <p className="text-[1rem] leading-8 text-[#eef5fb]">
                  {renderLinkedInPreviewText(preview.post_text)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
