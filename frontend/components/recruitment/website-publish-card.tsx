"use client";

import Link from "next/link";
import { Copy, Eye, FileText, Globe, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import type { VacancyRecord, WebsitePublishApiRecord } from "@/lib/recruitment-types";

type WebsitePublishCardProps = {
  vacancyId: string;
  vacancy: VacancyRecord;
};

type ActionState = "preview" | "generate-pdf" | "publish" | "delete" | null;

function formatMappedValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function buildDefaultResult(vacancy: VacancyRecord): WebsitePublishApiRecord {
  return {
    success: true,
    dry_run: true,
    message: "Website publish panel ready.",
    published: false,
    action: "idle",
    job_info_id: null,
    pdf_generated: false,
    pdf_filename: null,
    pdf_url: "",
    mapped_fields: {
      title: vacancy.title,
      location: vacancy.location,
      type: vacancy.employmentType,
      pdf_url: "",
      published: 0,
      created_by: 101,
    },
  };
}

export function WebsitePublishCard({ vacancyId, vacancy }: WebsitePublishCardProps) {
  const [result, setResult] = useState<WebsitePublishApiRecord | null>(null);
  const [loadingAction, setLoadingAction] = useState<ActionState>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const displayResult = useMemo(() => result ?? buildDefaultResult(vacancy), [result, vacancy]);

  const runAction = async (action: Exclude<ActionState, null>, path: string, fallbackMessage: string) => {
    setLoadingAction(action);
    setErrorMessage(null);

    try {
      const response = await apiRequest<WebsitePublishApiRecord>({
        path,
        method: "POST",
        body: JSON.stringify({
          vacancy_id: Number(vacancyId),
        }),
      });
      setResult(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setLoadingAction(null);
    }
  };

  const copyPdfUrl = async () => {
    const value = String(displayResult.mapped_fields.pdf_url || displayResult.pdf_url || "").trim();
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const pdfUrl = String(displayResult.mapped_fields.pdf_url || displayResult.pdf_url || "").trim();

  return (
    <div className="overflow-hidden rounded-2xl border border-[#3c4948]/40 bg-[#17202b] shadow-[0_16px_30px_rgba(0,0,0,0.14)]">
      <div className="p-7">
        <div className="flex items-start justify-between">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#859491]">
              Website Publish
            </span>
            <h3 className="mt-1 text-[18px] font-bold text-[#dae3f2]">Status Panel</h3>
          </div>
          <span className="rounded-xl bg-[#2c3541] p-3 text-[#859491]">
            <Globe className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              void runAction("preview", "/integrations/website/preview", "Failed to generate website publish preview.")
            }
            disabled={loadingAction !== null}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#3c4948]/40 bg-[#222b36] px-3 py-3 text-xs font-bold text-[#dae3f2] transition hover:bg-[#2c3541] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Eye className="h-3.5 w-3.5" />
            {loadingAction === "preview" ? "Loading..." : "Preview Payload"}
          </button>

          <button
            type="button"
            onClick={() =>
              void runAction(
                "generate-pdf",
                "/integrations/website/generate-pdf",
                "Failed to generate website PDF.",
              )
            }
            disabled={loadingAction !== null}
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#3c4948]/40 bg-[#222b36] px-3 py-3 text-xs font-bold text-[#dae3f2] transition hover:bg-[#2c3541] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText className="h-3.5 w-3.5" />
            {loadingAction === "generate-pdf" ? "Loading..." : "Gen Website PDF"}
          </button>

          <button
            type="button"
            onClick={() =>
              void runAction("publish", "/integrations/website/publish", "Failed to publish vacancy to website.")
            }
            disabled={loadingAction !== null}
            className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-[#62f9ee] px-4 py-3 text-sm font-bold text-[#00201e] transition hover:bg-[#3cdcd1] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {loadingAction === "publish" ? "Publishing..." : "Publish to Website"}
          </button>

          <button
            type="button"
            onClick={() =>
              void runAction("delete", "/integrations/website/delete", "Failed to remove vacancy from website.")
            }
            disabled={loadingAction !== null}
            className="col-span-2 mt-2 flex items-center justify-center gap-2 rounded-lg border border-[#ffb4ab]/30 bg-transparent px-4 py-2 text-xs font-bold text-[#ffb4ab] transition hover:bg-[#ffb4ab]/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {loadingAction === "delete" ? "Removing..." : "Delete from Website"}
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-lg border border-[#93000a] bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffdad6]">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-7 rounded-xl border border-[#3cdcd1]/20 bg-[#62f9ee]/[0.05] p-5">
          <div className="mb-3 flex items-center gap-2 text-[#3cdcd1]">
            <Globe className="h-3.5 w-3.5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">System Log</span>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-y-2 text-[12px]">
            <span className="text-[#859491]">Action:</span>
            <span className="font-mono text-[#dae3f2]">{displayResult.action}</span>
            <span className="text-[#859491]">Published:</span>
            <span className="font-mono text-[#dae3f2]">{displayResult.published ? "Yes" : "No"}</span>
            <span className="text-[#859491]">Job Info ID:</span>
            <span className="font-mono text-[#dae3f2]">{displayResult.job_info_id ?? "Not created yet"}</span>
            <span className="text-[#859491]">PDF Generated:</span>
            <span className="font-mono text-[#dae3f2]">{displayResult.pdf_generated ? "Yes" : "No"}</span>
          </div>

          {displayResult.pdf_generated && displayResult.pdf_url ? (
            <Link
              href={displayResult.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-xs font-bold text-[#62f9ee] transition hover:text-white"
            >
              Open generated PDF
            </Link>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[#3c4948]/30 p-7">
        <span className="mb-5 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#859491]">
          Mapped Fields
        </span>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#3c4948]/25 pb-3">
            <span className="text-xs text-[#859491]">TITLE</span>
            <span className="text-sm font-semibold text-[#dae3f2]">
              {formatMappedValue(displayResult.mapped_fields.title)}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-[#3c4948]/25 pb-3">
            <span className="text-xs text-[#859491]">LOCATION</span>
            <span className="text-sm font-semibold text-[#dae3f2]">
              {formatMappedValue(displayResult.mapped_fields.location)}
            </span>
          </div>

          <div className="flex flex-col gap-2 border-b border-[#3c4948]/25 pb-3">
            <span className="text-xs text-[#859491]">PDF URL</span>
            <div className="flex items-center gap-2 rounded-lg border border-[#3c4948]/30 bg-[#060f19] p-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#859491]">
                {pdfUrl || "Not generated yet"}
              </span>
              <button
                type="button"
                onClick={() => void copyPdfUrl()}
                className="text-[#3cdcd1] transition hover:scale-110"
                aria-label="Copy PDF URL"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            {copied ? <span className="text-[10px] text-[#62f9ee]">Copied</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
