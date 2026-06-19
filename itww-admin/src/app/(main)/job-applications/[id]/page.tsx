// src/app/(main)/job-applications/[id]/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Image from "next/image";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import InputGroup from "@/components/FormElements/InputGroup";
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

export default function JobApplicationViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [JobApplication, setJobApplication] = useState<JobApplication | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { token } = useAuthStore();

  useEffect(() => {
    if (!id) return;
    if (!token) return;
    const fetchJobApplication = async () => {
      try {
        const res = await fetch(`/api/jobs-application?id=${id}`);
        const data = await res.json();
        setJobApplication(data);
      } catch (err) {
        console.error("Failed to load JobApplication", err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobApplication();
  }, [token,id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setError("");

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

      setShowModal(false);
      router.push("/job-applications");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p>Loading JobApplication...</p>;
  if (!JobApplication) return <p>JobApplication not found.</p>;

  return (
    <>
      <Breadcrumb pageName="Job Application" />

      <div className="mx-auto max-w-full p-6">
        <div className="grid grid-cols-1 gap-9">
          <div className="flex flex-col gap-9">
            <ShowcaseSection
              title={JobApplication.job_category}
              className="space-y-5.5 !p-6.5"
            >
              {error && <p className="mb-2 text-red-500">{error}</p>}

              <a
                href={`/api/jobs-application/${JobApplication.job_applications_id}/resume`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                View Resume
              </a>

              <InputGroup
                label="Applicant Name"
                placeholder="Applicant Name"
                type="text"
                name="title"
                disabled
                value={JobApplication.name}
              />

              <InputGroup
                label="Email"
                placeholder="Email"
                type="text"
                name="email"
                disabled
                value={JobApplication.email}
              />

              <InputGroup
                label="Phone No."
                placeholder="Phone No."
                type="text"
                name="phone"
                disabled
                value={JobApplication.phone}
              />

              <InputGroup
                label="Hear From"
                placeholder="Hear From"
                type="text"
                name="hear"
                disabled
                value={JobApplication.hear}
              />

              <InputGroup
                label="Address"
                placeholder="Address"
                type="text"
                name="address"
                disabled
                value={JobApplication.address}
              />

              <InputGroup
                label="Date Applied"
                placeholder="Date Applied"
                type="text"
                name="title"
                disabled
                value={new Date(JobApplication.created_at).toLocaleDateString()}
              />

              <div className="mb-4 text-right">
                <button
                  onClick={() => setShowModal(true)}
                  className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                >
                  Delete
                </button>
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
                <span className="font-semibold">“{JobApplication.name}”</span>
                Application? This action cannot be undone.
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
