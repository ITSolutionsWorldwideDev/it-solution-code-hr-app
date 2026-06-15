// src/app/jobs-applications/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { TrashIcon } from "@/assets/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuthStore } from "@/store/useAuthStore";

interface JobApplication {
  job_applications_id: number;
  name: string;
  email: string;
  phone: string;
  hear: string;
  address: string;
  message: string;
  job_category_id: string;
  job_category: string;
  resume_data: string;
  resume_mime: string;
  resume_filename: string;
  created_at: string;
}

interface ApiResponse {
  items: JobApplication[];
  totalResults: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
}

// const PAGE_SIZE = 10;

export default function JobApplicationsListPage() {
  const [JobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected_job_applications, set_selected_job_applications] =
    useState<JobApplication | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { token } = useAuthStore();

  // ✅ Fetch jobsApplication
  const fetchjobsApplication = async (page = 1, limit = pageSize) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/jobs-application?page=${page}&limit=${limit}`,

        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data: ApiResponse = await res.json();
      setJobApplications(data.items || []);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
    } catch (err) {
      console.error("Failed to load jobsApplication", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchjobsApplication(currentPage);
  }, [currentPage]);

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobs-application?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to delete JobApplication");
      setJobApplications((prev) =>
        prev.filter((b) => b.job_applications_id !== id),
      );
      set_selected_job_applications(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p>Loading Jobs Application...</p>;

  return (
    <>
      <Breadcrumb pageName="Job Application" />
      <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark sm:p-7.5">
        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-base [&>th]:text-dark [&>th]:dark:text-white">
              <TableHead className="min-w-[200px] xl:pl-7.5">Name</TableHead>
              <TableHead>Job Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Hear From</TableHead>
              <TableHead>Resume</TableHead>
              <TableHead className="text-right xl:pr-7.5">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {JobApplications.length > 0 ? (
              JobApplications.map((JobApplication) => (
                <TableRow
                  key={JobApplication.job_applications_id}
                  className="border-[#eee] dark:border-dark-3"
                >
                  {/* Title */}
                  <TableCell className="min-w-[200px] xl:pl-7.5">
                    <Link
                      href={`/job-applications/${JobApplication.job_applications_id}`}
                      className="font-medium text-dark hover:underline dark:text-white"
                    >
                      {JobApplication.name}
                    </Link>
                  </TableCell>

                  {/* Job Type */}
                  <TableCell>
                    <p className="text-dark dark:text-white">
                      {JobApplication.job_category}
                    </p>
                  </TableCell>

                  {/* Email */}
                  <TableCell>
                    <p className="text-dark dark:text-white">
                      {JobApplication.email}
                    </p>
                  </TableCell>

                  {/* Phone */}
                  <TableCell>
                    <p className="text-dark dark:text-white">
                      {JobApplication.phone}
                    </p>
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    <p className="text-dark dark:text-white">
                      {dayjs(JobApplication.created_at).format("MMM DD, YYYY")}
                    </p>
                  </TableCell>

                  {/* Hear From */}
                  <TableCell>
                    <p className="text-dark dark:text-white">
                      {JobApplication.hear}
                    </p>
                  </TableCell>

                  {/* View Resume */}
                  <TableCell>
                    <a
                      href={`/api/jobs-application/${JobApplication.job_applications_id}/resume`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View Resume
                    </a>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="xl:pr-7.5">
                    <div className="flex items-center justify-end gap-x-3.5">
                      <button
                        onClick={() =>
                          set_selected_job_applications(JobApplication)
                        }
                        className="hover:text-red-600"
                        title="Delete JobApplication"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center">
                  No Job Applications found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t pt-4 text-sm sm:flex-row">
          {/* <p className="text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </p> */}

          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                setCurrentPage(1);
                fetchjobsApplication(1, newSize);
              }}
              className="rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-dark-3"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>items per page</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700",
                currentPage === 1 && "cursor-not-allowed opacity-50",
              )}
            >
              Previous
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (page) =>
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2),
              )
              .map((page, i, arr) => {
                const prev = arr[i - 1];
                const showEllipsis = prev && page - prev > 1;

                return (
                  <div key={page} className="flex items-center">
                    {showEllipsis && <span className="px-1">...</span>}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700",
                        page === currentPage
                          ? "bg-primary text-white hover:bg-primary/90"
                          : "",
                      )}
                    >
                      {page}
                    </button>
                  </div>
                );
              })}

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                "rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700",
                currentPage === totalPages && "cursor-not-allowed opacity-50",
              )}
            >
              Next
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {selected_job_applications && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirm Delete
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">
                  “{selected_job_applications.name}”
                </span>
                ? This action cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => set_selected_job_applications(null)}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleDelete(selected_job_applications.job_applications_id)
                  }
                  disabled={deleting}
                  className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
