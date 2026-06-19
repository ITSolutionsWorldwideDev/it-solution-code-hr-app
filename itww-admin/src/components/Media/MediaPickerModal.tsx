// src/components/Media/MediaPickerModal.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { UploadButton } from "@/utils/uploadthing";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaFile {
  media_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface MediaPickerModalProps {
  open: boolean;
  multiple?: boolean;
  module_ref?: string;
  onClose: () => void;
  onSelect: (files: { file_path: string; name: string }[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isImage = (type: string) => type?.startsWith("image/");
const isPdf = (type: string) => type === "application/pdf";

// ─── Component ────────────────────────────────────────────────────────────────

export default function MediaPickerModal({
  open,
  multiple = false,
  onClose,
  onSelect,
}: MediaPickerModalProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchMedia = useCallback(async (searchVal: string, pageVal: number) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(pageVal),
        limit: "12",
        search: searchVal,
      });
      const res = await fetch(`/api/media?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch media");
      setFiles(data.media || []);
      setPagination(data.pagination || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when modal opens, search changes, or page changes
  useEffect(() => {
    if (open) fetchMedia(search, page);
  }, [open, search, page, fetchMedia]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch("");
      setPage(1);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchMedia(search, 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  if (!open) return null;

  // ── Selection logic ────────────────────────────────────────────────────────

  const handleClick = (file: MediaFile) => {
    if (!multiple) {
      // Single select: confirm immediately
      onSelect([{ file_path: file.file_path, name: file.file_name }]);
      onClose();
      return;
    }
    const next = new Set(selected);
    if (next.has(file.media_id)) {
      next.delete(file.media_id);
    } else {
      next.add(file.media_id);
    }
    setSelected(next);
  };

  const handleConfirm = () => {
    const chosen = files
      .filter((f) => selected.has(f.media_id))
      .map((f) => ({ file_path: f.file_path, name: f.file_name }));
    onSelect(chosen);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[85vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">Media Library</h2>

          <div className="flex items-center gap-3">
            {/* Upload new file */}
            <UploadButton
              endpoint="imageUploader"
              onClientUploadComplete={() => {
                setPage(1);
                fetchMedia(search, 1);
              }}
              onUploadError={(err) => setError(err.message)}
              appearance={{
                button:
                  "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-opacity-90 transition-colors",
                allowedContent: "hidden",
              }}
            />

            {/* Close */}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div className="border-b px-6 py-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-xl bg-gray-200"
                />
              ))}
            </div>
          ) : files.length === 0 ? (
            /* Empty state */
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
              <svg
                className="h-14 w-14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm font-medium">
                {search ? `No results for "${search}"` : "No files uploaded yet"}
              </p>
            </div>
          ) : (
            /* File Grid */
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {files.map((file) => {
                const isSelected = selected.has(file.media_id);
                return (
                  <div
                    key={file.media_id}
                    onClick={() => handleClick(file)}
                    title={file.file_name}
                    className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all hover:shadow-md ${
                      isSelected
                        ? "border-primary shadow-md ring-2 ring-primary/20"
                        : "border-transparent hover:border-gray-200"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="flex aspect-square items-center justify-center overflow-hidden bg-gray-100">
                      {isImage(file.file_type) ? (
                        <img
                          src={file.file_path}
                          alt={file.file_name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : isPdf(file.file_type) ? (
                        <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                          <svg
                            className="h-9 w-9 text-red-500"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 17h8v-1H8v1zm0-3h8v-1H8v1zm0-3h5v-1H8v1z" />
                          </svg>
                          <span className="line-clamp-2 break-all text-xs text-gray-500">
                            {file.file_name}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 p-3">
                          <svg
                            className="h-9 w-9 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          <span className="line-clamp-2 break-all text-xs text-gray-500">
                            {file.file_name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Selected badge */}
                    {isSelected && (
                      <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow">
                        ✓
                      </div>
                    )}

                    {/* File name label */}
                    <p className="truncate bg-white px-1.5 py-1 text-xs text-gray-600">
                      {file.file_name}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-3">
          {/* Pagination */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination?.hasPrevPage || loading}
              className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">
              {pagination
                ? `Page ${pagination.page} / ${pagination.totalPages}`
                : "—"}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination?.hasNextPage || loading}
              className="rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>

          {/* Confirm (multiple mode only) */}
          {multiple ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {selected.size} selected
              </span>
              <button
                onClick={onClose}
                className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm text-white hover:bg-opacity-90 disabled:opacity-50"
              >
                Insert ({selected.size})
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="rounded-lg border px-4 py-1.5 text-sm text-gray-600 hover:bg-white"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}