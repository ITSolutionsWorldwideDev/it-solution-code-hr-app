"use client";

import { Edit3, Send } from "lucide-react";
import { useMemo, useState } from "react";

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

  return `${cleanedPost}\n\nApply here:\n${applyUrl}`.trim();
}

function renderLinkedInPreviewText(postText: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const lines = postText.split("\n");

  return lines.map((line, lineIndex) => {
    const parts = line.split(urlPattern);

    return (
      <span key={`line-${lineIndex}`}>
        {parts.map((part, partIndex) => {
          if (/^https?:\/\/[^\s]+$/i.test(part)) {
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

function truncateLinkedInText(postText: string, maxLength: number) {
  if (postText.length <= maxLength) {
    return postText;
  }

  return `${postText.slice(0, maxLength).trimEnd()}...`;
}

function extractCompensation(vacancy: VacancyRecord) {
  const lines = vacancy.description.split("\n");
  const line = lines.find((item) => /salary indication|compensation/i.test(item));
  return line?.split(":").slice(1).join(":").trim() || "Compensation on request";
}

export function LinkedInPreviewCard({ vacancyId, vacancy }: LinkedInPreviewCardProps) {
  const [preview, setPreview] = useState<LinkedInPreviewApiRecord | null>(null);
  const [loadingAction, setLoadingAction] = useState<"preview" | "publish" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFullText, setShowFullText] = useState(false);

  const localPreview = useMemo(() => {
    const applyUrl =
      typeof window === "undefined"
        ? `/apply/${vacancyId}`
        : new URL(`/apply/${vacancyId}`, window.location.origin).toString();
    const postText = ensureApplyUrlInPostText(vacancy.description, applyUrl);

    return {
      success: true,
      dry_run: true,
      message: "LinkedIn preview generated.",
      post_text: postText,
      apply_url: applyUrl,
    } satisfies LinkedInPreviewApiRecord;
  }, [vacancy.description, vacancyId]);

  const currentPreview = preview ?? localPreview;
  const salary = extractCompensation(vacancy);
  const fullPreviewText = currentPreview.post_text.trim();
  const previewText = showFullText ? fullPreviewText : truncateLinkedInText(fullPreviewText, 220);
  const canExpand = fullPreviewText.length > 220;

  const handlePreview = () => {
    setLoadingAction("preview");
    setErrorMessage(null);
    setPreview(localPreview);
    setLoadingAction(null);
  };

  const handlePublish = async () => {
    setLoadingAction("publish");
    setErrorMessage(null);

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
      setErrorMessage(error instanceof Error ? error.message : "Failed to process the LinkedIn action.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[#3c4948]/40 bg-[#17202b] p-7 shadow-[0_16px_30px_rgba(0,0,0,0.14)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0077b5] text-white">
            <span className="text-sm font-bold">in</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#859491]">
              Social Connect
            </span>
            <h3 className="text-[16px] font-bold text-[#dae3f2]">LinkedIn Post</h3>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePreview}
          className="group inline-flex items-center gap-1 text-xs font-bold text-[#3cdcd1]"
        >
          Edit Post
          <Edit3 className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-[#93000a] bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffdad6]">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-[#3c4948]/30 bg-[#060f19] p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#3c4948]/30 bg-[#222b36] text-white">
            <span className="text-sm font-bold">IT</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#dae3f2]">Recruitment Pro IT</span>
            <span className="text-[10px] text-[#859491]">Promoted • Worldwide</span>
          </div>
        </div>

        <div className="space-y-3 font-mono text-[12px] leading-relaxed text-[#bacac7]">
          <p className="font-semibold text-white">{vacancy.title} | IT Solutions Worldwide</p>
          <p>
            📍 Location: {vacancy.location}
            <br />💼 Job Type: {vacancy.employmentType}
            <br />💰 Salary: {salary}
          </p>
          <p>{renderLinkedInPreviewText(previewText)}</p>
          {canExpand ? (
            <button
              type="button"
              onClick={() => setShowFullText((current) => !current)}
              className="text-left text-[10px] font-bold text-[#62f9ee]"
            >
              {showFullText ? "show less" : "...see more"}
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[#3c4948]/20 pt-4">
          <div className="flex gap-4 text-[#859491]">
            <span>👍</span>
            <span>💬</span>
            <span>↗</span>
          </div>
          <button type="button" className="rounded-full bg-[#0077b5] px-3 py-1.5 text-[10px] font-bold text-white">
            Apply Now
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handlePublish()}
        disabled={loadingAction !== null}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#62f9ee] px-4 py-2.5 text-xs font-bold text-[#62f9ee] transition hover:bg-[#62f9ee]/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-3.5 w-3.5" />
        {loadingAction === "publish" ? "Posting..." : "Post to LinkedIn"}
      </button>
    </div>
  );
}
