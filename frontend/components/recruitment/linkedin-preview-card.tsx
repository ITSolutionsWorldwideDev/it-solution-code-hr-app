"use client";

import { Edit3, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import { cleanInlineJobText, normalizeJobText } from "@/lib/job-text";
import type { LinkedInPreviewApiRecord, VacancyRecord } from "@/lib/recruitment-types";

type LinkedInPreviewCardProps = {
  vacancyId: string;
  vacancy: VacancyRecord;
};

function isLocalDevHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

const configuredPublicApplyBaseUrl = process.env.NEXT_PUBLIC_PUBLIC_APPLY_BASE_URL?.trim() || "";

function normalizeApplyBaseUrl(value: string) {
  return value.replace(/\/apply(?=\/?$)/i, "/careers").replace(/\/$/, "");
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

function getCurrentPublicApplyBaseUrl() {
  if (configuredPublicApplyBaseUrl) {
    return normalizeApplyBaseUrl(configuredPublicApplyBaseUrl);
  }

  if (typeof window === "undefined") {
    return null;
  }

  return new URL("/careers", window.location.origin).toString().replace(/\/$/, "");
}

function normalizeLocalPostText(postText: string, originalApplyUrl: string, normalizedApplyUrl: string) {
  let nextText = normalizeJobText(postText);

  if (originalApplyUrl !== normalizedApplyUrl) {
    nextText = nextText.replaceAll(originalApplyUrl, normalizedApplyUrl);
  }

  nextText = nextText.replace(/(https?:\/\/[^\s]+)\/apply\/(\d+)/gi, "$1/careers/$2");

  return nextText.trim();
}

function renderLinkedInPreviewText(postText: string) {
  const urlPattern = /(https?:\/\/[^\s]+|\[Application Link\])/g;
  const headingPattern = /^(About Us|The Role|Key Responsibilities|Requirements & Qualifications|What We Offer|How to Apply)$/i;
  const bulletPattern = /^[*-]\s*/;
  const lines = postText.split("\n");

  return lines.map((line, lineIndex) => {
    const trimmedLine = line.trim();
    const parts = line.split(urlPattern);

    const renderedInline = parts.map((part, partIndex) => {
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
    });

    if (!trimmedLine) {
      return <div key={`line-${lineIndex}`} className="h-3" />;
    }

    if (headingPattern.test(trimmedLine)) {
      return (
        <p key={`line-${lineIndex}`} className="pt-2 text-[13px] font-bold text-white">
          {renderedInline}
        </p>
      );
    }

    if (bulletPattern.test(trimmedLine)) {
      return (
        <div key={`line-${lineIndex}`} className="flex items-start gap-2">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#9fd0ff]" />
          <p>{cleanInlineJobText(parts.join(""))}</p>
        </div>
      );
    }

    return <p key={`line-${lineIndex}`}>{renderedInline}</p>;
  });
}

function truncateLinkedInText(postText: string, maxLength: number) {
  if (postText.length <= maxLength) {
    return postText;
  }

  return `${postText.slice(0, maxLength).trimEnd()}...`;
}

function buildLinkedInPostText(vacancy: VacancyRecord, applyUrl: string) {
  const cleanUrl = applyUrl;

  return normalizeJobText(vacancy.description)
    .replace("[application link generated after approval]", cleanUrl)
    .replace("[Application Link]", cleanUrl)
    .replace(/^Apply here:\s*.+$/gim, `Apply here: ${cleanUrl}`)
    .replace(/^Location:\s*/gim, "Location: ")
    .replace(/^Job Type:\s*/gim, "Job Type: ")
    .replace(/^Employment Type:\s*/gim, "Employment Type: ")
    .replace(/^Salary Indication:\s*/gim, "Salary: ")
    .replace(/^Compensation:\s*/gim, "Compensation: ")
    .replace(/^Apply here:\s*/gim, "Apply here: ")
    .replace(/^\s*---\s*$/gim, "")
    .replace(/^(About Us|The Role|Key Responsibilities|Requirements & Qualifications|What We Offer|How to Apply)$/gim, "\n$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function LinkedInPreviewCard({ vacancyId, vacancy }: LinkedInPreviewCardProps) {
  const [preview, setPreview] = useState<LinkedInPreviewApiRecord | null>(null);
  const [loadingAction, setLoadingAction] = useState<"preview" | "publish" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFullText, setShowFullText] = useState(false);

  const localPreview = useMemo(() => {
    const publicApplyBaseUrl = getCurrentPublicApplyBaseUrl();
    const applyUrl = publicApplyBaseUrl
      ? `${publicApplyBaseUrl.replace(/\/$/, "")}/${vacancyId}`
      : typeof window === "undefined"
        ? `/careers/${vacancyId}`
        : new URL(`/careers/${vacancyId}`, window.location.origin).toString();
    const postText = buildLinkedInPostText(vacancy, applyUrl);

    return {
      success: true,
      dry_run: true,
      message: "LinkedIn preview generated.",
      post_text: postText,
      apply_url: applyUrl,
    } satisfies LinkedInPreviewApiRecord;
  }, [vacancy.description, vacancyId, vacancy]);

  const currentPreview = preview ?? localPreview;
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
          public_apply_base_url: getCurrentPublicApplyBaseUrl(),
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
            <span>Like</span>
            <span>Comment</span>
            <span>Share</span>
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
