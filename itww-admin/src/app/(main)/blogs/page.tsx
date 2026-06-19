// src/app/blogs/page.tsx
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

interface Blog {
  blog_id: number;
  title: string;
  slug: string;
  content: string;
  imageurl?: string;
  author_username?: string;
  author_email?: string;
  created_at: string;
  published: number;
}

interface ApiResponse {
  items: Blog[];
  totalResults: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

export default function BlogListPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { token } = useAuthStore();

  // ✅ Fetch blogs
  const fetchBlogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blogs?page=${page}&limit=${PAGE_SIZE}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const data: ApiResponse = await res.json();
      setBlogs(data.items || []);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
    } catch (err) {
      console.error("Failed to load blogs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // ✅ Handle blog delete
  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/blogs?id=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete blog");
      setBlogs((prev) => prev.filter((b) => b.blog_id !== id));
      setSelectedBlog(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p>Loading blogs...</p>;

  return (
    <>
      <Breadcrumb pageName="Blogs" />
      <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark sm:p-7.5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/blogs/new"
            className="rounded-md bg-primary px-4 py-2 text-white hover:bg-opacity-90"
          >
            + New Blog
          </Link>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow className="border-none bg-[#F7F9FC] dark:bg-dark-2 [&>th]:py-4 [&>th]:text-base [&>th]:text-dark [&>th]:dark:text-white">
              <TableHead className="min-w-[200px] xl:pl-7.5">Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right xl:pr-7.5">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {blogs.length > 0 ? (
              blogs.map((blog) => (
                <TableRow
                  key={blog.blog_id}
                  className="border-[#eee] dark:border-dark-3"
                >
                  {/* Title */}
                  <TableCell className="min-w-[200px] xl:pl-7.5">
                    <Link
                      href={`/blogs/${blog.blog_id}`}
                      className="font-medium text-dark hover:underline dark:text-white"
                    >
                      {blog.title}
                    </Link>
                  </TableCell>

                  {/* Author */}
                  <TableCell>
                    <p className="text-dark dark:text-white">
                      {blog.author_username || blog.author_email || "Unknown"}
                    </p>
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    <p className="text-dark dark:text-white">
                      {dayjs(blog.created_at).format("MMM DD, YYYY")}
                    </p>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <div
                      className={cn(
                        "max-w-fit rounded-full px-3.5 py-1 text-sm font-medium",
                        {
                          "bg-[#219653]/[0.08] text-[#219653]":
                            blog.published === 1,
                          "bg-[#D34053]/[0.08] text-[#D34053]":
                            blog.published === 0,
                        },
                      )}
                    >
                      {blog.published === 1 ? "Published" : "Draft"}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="xl:pr-7.5">
                    <div className="flex items-center justify-end gap-x-3.5">
                      <Link
                        href={`/blogs/${blog.blog_id}/edit`}
                        className="hover:text-primary"
                        title="Edit Blog"
                      >
                        ✏️
                      </Link>

                      <button
                        onClick={() => setSelectedBlog(blog)}
                        className="hover:text-red-600"
                        title="Delete Blog"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center">
                  No blogs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t pt-4 text-sm sm:flex-row">
          <p className="text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </p>

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
        {selectedBlog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirm Delete
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">“{selectedBlog.title}”</span>?
                This action cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedBlog(null)}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(selectedBlog.blog_id)}
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
