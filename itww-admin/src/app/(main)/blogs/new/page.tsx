// src/app/(main)/blogs/new/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import InputGroup from "@/components/FormElements/InputGroup";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import MediaPickerModal from "@/components/Media/MediaPickerModal";
import TipTapEditor from "@/components/FormElements/InputGroup/text-area-editor";
import { useAuthStore } from "@/store/useAuthStore";

export default function BlogFormPage() {
  const router = useRouter();

  const [showMediaModal, setShowMediaModal] = useState(false);
  const [error, setError] = useState("");

  const { token } = useAuthStore();

  const [form, setForm] = useState({
    title: "",
    content: "",
    imageUrl: "",
    published: false,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleEditorChange = (name: string, value: string) => {
    if (!form) return;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // const method = blogId ? "PUT" : "POST";
    // const body = blogId ? { ...form, blog_id: blogId } : form;

    const method = "POST";
    const body = form;

    try {
      const res: any = await fetch("/api/blogs", {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save blog");

      if (res.ok) {
        router.push("/blogs");
      } else {
        console.error("res  ==== ", res);
        alert(res.error);
        // alert("Failed to save blog");
      }
    } catch (err: any) {
      console.error("err  ==== ", err);
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <>
      <Breadcrumb pageName="Blogs" />
      <div className="grid grid-cols-1 gap-9">
        <div className="flex flex-col gap-9">
          <ShowcaseSection title="Add Blog" className="space-y-5.5 !p-6.5">
            {error && <p className="mb-2 text-red-500">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <InputGroup
                label="Title"
                placeholder="Blog Title"
                type="text"
                name="title"
                active
                required
                handleChange={handleChange}
              />
              <TipTapEditor
                label="Blog Content"
                placeholder="Write your blog content here..."
                required
                name="content"
                value={form.content}
                // onChange={(name, html) => setForm({ ...form, [name]: html })}
                onChange={handleEditorChange}
              />

              {/* <TextAreaGroup
                label="Blog Content"
                placeholder="Blog Content"
                active
                required
                name="content"
                handleChange={handleChange}
              /> */}

              {/* <InputGroup
                label="Image URL"
                placeholder="Image URL"
                type="text"
                name="imageUrl"
                active
                handleChange={handleChange}
              /> */}

              {/* Featured Image Picker */}
              <div>
                <label className="mb-2 block font-medium">Featured Image</label>

                {form.imageUrl ? (
                  <div className="relative w-40">
                    <img
                      src={form.imageUrl}
                      alt="Featured"
                      className="rounded border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: "" })}
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
                    module_ref: "blogs",
                    onClose: () => setShowMediaModal(false),
                    onSelect: (files: any) => {
                      if (files[0]) {
                        setForm({ ...form, imageUrl: files[0].file_path });
                      }
                    },
                  } as any)}
                />
              )}

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="published"
                  checked={form.published}
                  onChange={handleChange}
                />
                <span>Published</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-primary px-4 py-2 text-white hover:bg-opacity-90"
              >
                {loading ? "Saving..." : "Save Blog"}
              </button>
            </form>
          </ShowcaseSection>
        </div>
      </div>
    </>
  );
}
