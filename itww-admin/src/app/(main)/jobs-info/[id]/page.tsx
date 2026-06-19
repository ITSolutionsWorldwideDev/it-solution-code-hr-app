// src/app/jobs-info/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Image from "next/image";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import InputGroup from "@/components/FormElements/InputGroup";
import { useAuthStore } from "@/store/useAuthStore";

interface JobInfo {
  job_info_id: number;
  title: string;
  location: string;
  type: string;
  pdf_url?: string;
  author_username?: string;
  author_email?: string;
  created_at: string;
  updated_at: string;
  published: number;
}

export default function JobInfoViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { token } = useAuthStore();

  useEffect(() => {
    if (!id) return;    
    if (!token) return;
    const fetchJobInfo = async () => {
      try {
        if (!token) return;
        const res = await fetch(`/api/jobs-info?id=${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setJobInfo(data);
      } catch (err) {
        console.error("Failed to load JobInfo", err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobInfo();
  }, [token,id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setError("");

    try {
      if (!token) return;
      const res = await fetch(`/api/jobs-info?id=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete JobInfo");

      setShowModal(false);
      router.push("/jobs-info");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p>Loading JobInfo...</p>;
  if (!jobInfo) return <p>JobInfo not found.</p>;

  return (
    <>
      <Breadcrumb pageName="Job Info" />
      <div className="mx-auto max-w-full p-6">
        <div className="grid grid-cols-1 gap-9">
          <div className="flex flex-col gap-9">
            <ShowcaseSection
              title={jobInfo.title}
              className="space-y-5.5 !p-6.5"
            >
              {error && <p className="mb-2 text-red-500">{error}</p>}

              <InputGroup
                label="Job Type"
                placeholder="Job Type"
                type="text"
                name="type"
                disabled
                value={jobInfo.type}
              />

              <InputGroup
                label="Job Location"
                placeholder="Job Location"
                type="text"
                name="location"
                disabled
                value={jobInfo.location}
              />

              <InputGroup
                label="Date Applied"
                placeholder="Date Applied"
                type="text"
                name="title"
                disabled
                value={new Date(jobInfo.created_at).toLocaleDateString()}
              />

              {/* <Image
                  src={jobInfo.pdf_url}
                  alt={jobInfo.title}
                  width={400}
                  height={400}
                  className="mb-4 w-full rounded-lg"
                /> */}

              {jobInfo.pdf_url?.length && (
                <>
                  <label className="mb-2 block font-medium">
                    Featured Image
                  </label>
                  <div className="relative w-40 rounded border bg-gray-50 p-2 hover:shadow-md">
                    <div className="flex aspect-square items-center text-center justify-center bg-gray-200 text-sm text-gray-600">
                      <a target="_blank" href={jobInfo.pdf_url}>
                        application/pdf <br />{jobInfo.title}
                      </a>
                    </div>
                  </div>
                </>
              )}

              <div className="mb-4 text-right">
                <div className="flex gap-2">
                  <Link
                    href={`/jobs-info/${jobInfo.job_info_id}/edit`}
                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => setShowModal(true)}
                    className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </ShowcaseSection>
          </div>
        </div>
        {/* Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirm Delete
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold">“{jobInfo.title}”</span>? This
                action cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
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
