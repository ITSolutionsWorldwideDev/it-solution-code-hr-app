// src/app/(main)/blogs/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import InputGroup from "@/components/FormElements/InputGroup";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import MediaPickerModal from "@/components/Media/MediaPickerModal";
// import TipTapEditor from "@/components/FormElements/InputGroup/text-area-editor";
import ClientSideCustomEditor from "@/components/FormElements/InputGroup/client-side-custom-editor";
import { useAuthStore } from "@/store/useAuthStore";
import TipTapEditor from "@/components/FormElements/InputGroup/text-area-editor";

interface BlogFormData {
  blog_id: number;
  title: string;
  content: string;
  imageUrl?: string;
  published: boolean;
}

export default function EditBlogPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState<BlogFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { token } = useAuthStore();

  const [showMediaModal, setShowMediaModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (!token) return;
    const fetchBlog = async () => {
      try {
        const res = await fetch(`/api/blogs?id=${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load blog");
        setForm({
          blog_id: data.blog_id,
          title: data.title,
          content: data.content,
          imageUrl: data.imageurl,
          published: !!data.published,
        });
      } catch (err: any) {
        setError(err.message);
        alert(err.error);
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [token, id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!form) return;
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditorChange = (name: string, value: string) => {
    if (!form) return;
    setForm({ ...form, [name]: value });
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
      const res = await fetch("/api/blogs", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update blog");

      router.push(`/blogs/${data.blog_id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading blog...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!form) return <p>Blog not found.</p>;

  return (
    <>
      <Breadcrumb pageName="Blogs" />
      <div className="grid grid-cols-1 gap-9">
        <div className="flex flex-col gap-9">
          <ShowcaseSection title="Edit Blog" className="space-y-5.5 !p-6.5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <InputGroup
                label="Title"
                placeholder="Blog Title"
                type="text"
                name="title"
                active
                required
                handleChange={handleChange}
                value={form.title}
              />
              {/* <TipTapEditor
                label="Blog Content"
                placeholder="Write your blog content here..."
                required
                name="content"
                value={form.content}
                // onChange={(name, html) => setForm({ ...form, [name]: html })}
                onChange={handleEditorChange}
              /> */}

              {/* <ClientSideCustomEditor
                name="content"
                value={form.content}
                placeholder="Write your blog content here..."
                onChange={handleEditorChange}
                onOpenMediaModal={() => setShowMediaModal(true)}
              /> */}

              <TipTapEditor
                label="Blog Content"
                placeholder="Write your blog content here..."
                required
                name="content"
                value={form.content}
                onChange={handleEditorChange}
              />

              {/* Featured Image */}
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

              {/* Media Picker Modal */}
              {/* {showMediaModal && (
                <MediaPickerModal
                  open={showMediaModal}
                  multiple={false}
                  module_ref="blogs"
                  onClose={() => setShowMediaModal(false)}
                  onSelect={(files) => {

                    console.log('files === ',files);
                    if (files[0]) {
                      const imageUrl = files[0].file_path;

                      console.log('imageUrl === ',imageUrl);

                      // Insert image directly into CKEditor content
                      const temp = document.querySelector(
                        ".ck-editor__editable",
                      );

                      console.log('temp === ',temp);
                      console.log('form === ',form);

                      if (temp && form) {
                        const newHtml = `${form.content || ""}<p><img src="${imageUrl}" alt="" /></p>`;
                        setForm({ ...form, content: newHtml });
                      }

                      setShowMediaModal(false);
                    }
                    // if (files[0]) {
                    //   setForm({ ...form, imageUrl: files[0].file_path });
                    // }
                  }}
                />
              )} */}
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
