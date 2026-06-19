// src/app/blogs/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Image from "next/image";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import InputGroup from "@/components/FormElements/InputGroup";
import { TextAreaGroup } from "@/components/FormElements/InputGroup/text-area";
import { useAuthStore } from "@/store/useAuthStore";

interface Blog {
  blog_id: number;
  title: string;
  content: string;
  imageurl?: string;
  author_username?: string;
  author_email?: string;
  created_at: string;
  updated_at: string;
  published: number;
}

export default function BlogViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const { token } = useAuthStore();

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
        setBlog(data);
      } catch (err) {
        console.error("Failed to load blog", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [token,id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/blogs?id=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete blog");

      setShowModal(false);
      router.push("/blogs");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p>Loading blog...</p>;
  if (!blog) return <p>Blog not found.</p>;

  function handleEditorChange(name: string, value: string): void {
    throw new Error("Function not implemented.");
  }

  return (
    <>
      <Breadcrumb pageName="Blog View" />
      <div className="mx-auto max-w-full p-6">
        <div className="grid grid-cols-1 gap-9">
          <div className="flex flex-col gap-9">
            <ShowcaseSection title="" className="space-y-5.5 !p-6.5">
              {error && <p className="mb-2 text-red-500">{error}</p>}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <Link
                    href={`/blogs/${blog.blog_id}/edit`}
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

              <form className="space-y-4">
                <InputGroup
                  label="Title"
                  placeholder="Blog Title"
                  type="text"
                  name="title"
                  disabled
                  value={blog.title}
                />

                <InputGroup
                  label="Date Created"
                  placeholder="Date Created"
                  type="text"
                  name="title"
                  disabled
                  value={new Date(blog.created_at).toLocaleDateString()}
                />
                <div>
                  <label className="mb-2 block font-medium">
                    Featured Image
                  </label>
                  {blog.imageurl && (
                    <Image
                      src={blog.imageurl}
                      alt={blog.title}
                      width={400}
                      height={400}
                      className="w-{400} h-{400} mb-4 rounded-lg"
                    />
                  )}
                </div>
                {/* <TextAreaGroup
                  label="Blog Content"
                  placeholder="Blog Content"
                  active
                  required
                  name="content"
                  defaultValue={blog.content}
                /> */}
                <label className="mb-2 block font-medium">Content</label>
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: blog.content }}
                />
              </form>
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
                <span className="font-semibold">“{blog.title}”</span>? This
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
