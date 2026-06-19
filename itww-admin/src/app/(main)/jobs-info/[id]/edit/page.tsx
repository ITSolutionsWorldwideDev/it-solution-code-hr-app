// src/app/(main)/jobs-info/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import InputGroup from "@/components/FormElements/InputGroup";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import MediaPickerModal from "@/components/Media/MediaPickerModal";
import { useAuthStore } from "@/store/useAuthStore";

interface JobInfoFormData {
  job_info_id: number;
  title: string;
  location: string;
  type: string;
  pdf_url?: string;
  published: boolean;
}

export default function EditJobInfoPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState<JobInfoFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showMediaModal, setShowMediaModal] = useState(false);

  const { token } = useAuthStore();

  useEffect(() => {
    if (!id) return;
    if (!token) return;
    const fetchJobInfo = async () => {
      try {
        const res = await fetch(`/api/jobs-info?id=${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load JobInfo");
        setForm({
          job_info_id: data.job_info_id,
          title: data.title,
          location: data.location,
          type: data.type,
          pdf_url: data.pdf_url,
          published: !!data.published,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchJobInfo();
  }, [token, id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleToggle = () => {
    if (!form) return;
    setForm({ ...form, published: !form.published });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/jobs-info", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update JobInfo");

      router.push(`/jobs-info/${data.job_info_id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading JobInfo...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!form) return <p>JobInfo not found.</p>;

  return (
    <>
      <Breadcrumb pageName="Job Info" />
      <div className="grid grid-cols-1 gap-9">
        <div className="flex flex-col gap-9">
          <ShowcaseSection title="Edit Job Info" className="space-y-5.5 !p-6.5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <InputGroup
                label="Title"
                placeholder="JobInfo Title"
                type="text"
                name="title"
                active
                required
                handleChange={handleChange}
                value={form.title}
              />

              <InputGroup
                label="Location"
                placeholder="Location"
                type="text"
                name="location"
                active
                required
                handleChange={handleChange}
                value={form.location}
              />

              <InputGroup
                label="Type"
                placeholder="Type"
                type="text"
                name="type"
                active
                required
                handleChange={handleChange}
                value={form.type}
              />

              {/* <InputGroup
                label="PDF URL"
                placeholder="PDF URL"
                type="text"
                name="pdf_url"
                active
                handleChange={handleChange}
                value={form.pdf_url || ""}
              /> */}

              {/* Featured Image */}
              {/* <img
                      src={form.pdf_url}
                      alt="Featured"
                      className="rounded border object-cover"
                    /> */}

              <div>
                <label className="mb-2 block font-medium">Featured Image</label>
                {form.pdf_url ? (
                  <div className="relative w-40 rounded border bg-gray-50 p-2 hover:shadow-md">
                    <div className="flex aspect-square items-center justify-center bg-gray-200 text-center text-sm text-gray-600">
                      <a target="_blank" href={form.pdf_url}>
                        application/pdf <br />
                        {form.title}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, pdf_url: "" })}
                      className="absolute right-1 top-1 rounded bg-red-600 px-2 py-1 text-xs text-white"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowMediaModal(true)}
                    className="rounded border border-dashed border-gray-400 px-4 py-2 hover:border-primary"
                  >
                    + Select Featured Image
                  </button>
                )}
              </div>

              {/* Media Picker Modal */}
              {showMediaModal && (
                <MediaPickerModal
                  {...({
                    open: showMediaModal,
                    multiple: false,
                    module_ref: "jobs_desc",
                    onClose: () => setShowMediaModal(false),
                    onSelect: (files: any) => {
                      if (files[0]) {
                        setForm({ ...form, pdf_url: files[0].file_path });
                      }
                    },
                  } as any)}
                />
              )}

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={handleToggle}
                />
                <span>Published</span>
              </label>

              {error && <p className="text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="rounded bg-primary px-4 py-2 text-white hover:bg-opacity-90"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </ShowcaseSection>
        </div>
      </div>
    </>
  );
}
