//  src/components/FormElements/InputGroup/text-area-editor.tsx
"use client";

import React, { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import BubbleMenuExtension from "@tiptap/extension-bubble-menu";

// import { EditorContent, useEditor } from "@tiptap/react";
// import { BubbleMenu } from "@tiptap/extension-bubble-menu";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import MediaPickerModal from "@/components/Media/MediaPickerModal";

import Heading from "@tiptap/extension-heading";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Document from "@tiptap/extension-document";
import { Dropcursor } from "@tiptap/extensions";

import Placeholder from "@tiptap/extension-placeholder";
// optional community plugin for resizing
import ResizeImage from "tiptap-extension-resize-image";

interface TipTapEditorProps {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (name: string, value: string) => void;
}

export default function TipTapEditor({
  label,
  name,
  value,
  placeholder,
  required,
  disabled,
  onChange,
}: TipTapEditorProps) {
  const [isClient, setIsClient] = useState(false);
  const [openMedia, setOpenMedia] = useState(false);

  const [showHTML, setShowHTML] = useState(false);
  const [htmlCode, setHtmlCode] = useState(value || "");

  useEffect(() => setIsClient(true), []);

  const editor = useEditor({
    // extensions: [
    //   StarterKit,
    //   Underline,
    //   Link.configure({ openOnClick: false }),
    //   Image.configure({ HTMLAttributes: { class: "max-w-full rounded-md" } }),
    //   TextAlign.configure({ types: ["heading", "paragraph"] }),
    // ],
    extensions: [
      Document,
      Paragraph,
      Text,
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Image.configure({ HTMLAttributes: { class: "max-w-full rounded-md" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: placeholder || "Start typing here...",
      }),
    ],
    content: value || "<p></p>",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(name, editor.getHTML()),
  });

  // Keep editor content in sync
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "<p></p>");
    }
  }, [value, editor]);

  // ✅ Insert image into editor
  const handleImageInsert = (selected: any[]) => {
    if (!selected || selected.length === 0) return;
    const file = selected[0]; // pick first if multiple not used
    const imageUrl = file.file_path;
    editor?.chain().focus().setImage({ src: imageUrl }).run();
    setOpenMedia(false);
  };

  // Keep editor content synced when switching modes
  useEffect(() => {
    if (!editor) return;

    if (!showHTML) {
      // When switching back to WYSIWYG, set content from HTML editor
      editor.commands.setContent(htmlCode);
    } else {
      // When switching to HTML mode, get HTML from TipTap
      setHtmlCode(editor.getHTML());
    }
  }, [showHTML]);

  // Keep outer form value in sync
  useEffect(() => {
    if (editor && !showHTML) {
      editor.commands.setContent(value || "<p></p>");
    } else if (showHTML && value !== htmlCode) {
      setHtmlCode(value || "");
    }
  }, [value, showHTML, editor]);

  if (!isClient)
    return (
      <div className="min-h-[200px] animate-pulse rounded-lg border border-stroke bg-gray-50 p-3 dark:border-dark-3 dark:bg-dark-2" />
    );

  if (!editor) return <p>Loading editor...</p>;

  return (
    <div className="space-y-3">
      <label className="block text-body-sm font-medium text-dark dark:text-white">
        {label} {required && "*"}
      </label>

      <div className="mb-2 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("bold") ? "bg-primary text-white" : "bg-gray-200"
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("italic") ? "bg-primary text-white" : "bg-gray-200"
          }`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("underline")
              ? "bg-primary text-white"
              : "bg-gray-200"
          }`}
        >
          U
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("strike") ? "bg-primary text-white" : "bg-gray-200"
          }`}
        >
          S
        </button>

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("heading", { level: 1 })
              ? "bg-primary text-white"
              : "bg-gray-200"
          }`}
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("heading", { level: 2 })
              ? "bg-primary text-white"
              : "bg-gray-200"
          }`}
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHeading({ level: 3 }).run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("heading", { level: 3 })
              ? "bg-primary text-white"
              : "bg-gray-200"
          }`}
        >
          H3
        </button>

        {/* Paragraph (span/div simulation) */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("paragraph")
              ? "bg-primary text-white"
              : "bg-gray-200"
          }`}
        >
          P
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleNode("paragraph", "paragraph").run()
          }
          className="rounded bg-gray-200 px-2 py-1"
        >
          DIV
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className="rounded bg-gray-200 px-2 py-1"
        >
          Left
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className="rounded bg-gray-200 px-2 py-1"
        >
          Center
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className="rounded bg-gray-200 px-2 py-1"
        >
          Right
        </button>

        <button
          type="button"
          onClick={() => setOpenMedia(true)}
          className="rounded bg-gray-200 px-2 py-1"
        >
          🖼️ Image
        </button>

        {/* External Link */}
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter URL");
            if (url) {
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run();
            }
          }}
          className={`rounded px-2 py-1 ${
            editor.isActive("link") ? "bg-primary text-white" : "bg-gray-200"
          }`}
        >
          🔗 Link
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="rounded bg-gray-200 px-2 py-1"
        >
          ❌ Unlink
        </button>

        <button
          type="button"
          onClick={() => setShowHTML(!showHTML)}
          className={`rounded px-2 py-1 ${
            showHTML ? "bg-primary text-white" : "bg-gray-200"
          }`}
        >
          {"</>"} HTML
        </button>
      </div>

      <div
        className={`min-h-[200px] rounded-lg border border-stroke p-3 dark:border-dark-3 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {!showHTML ? (
          <EditorContent
            editor={editor}
            className="prose dark:prose-invert max-w-none focus:outline-none"
          />
        ) : (
          <textarea
            value={htmlCode}
            onChange={(e) => {
              setHtmlCode(e.target.value);
              onChange(name, e.target.value);
            }}
            className="h-[300px] w-full resize-none rounded border-none bg-gray-100 p-2 font-mono text-sm text-dark outline-none dark:bg-dark-2 dark:text-white"
          />
        )}
      </div>

      {openMedia && (
        <MediaPickerModal
          {...({
            open: openMedia,
            onClose: () => setOpenMedia(false),
            multiple: false,
            module_ref: "blogs",
            onSelect: handleImageInsert,
          } as any)}
        />
      )}
    </div>
  );
}

/* export default function TipTapEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (content: string) => void;
}) {
  const [showMediaModal, setShowMediaModal] = useState(false);

  // const editor = useEditor({
  //   extensions: [
  //     StarterKit,
  //     Placeholder.configure({ placeholder: "Write your blog..." }),
  //     TextAlign.configure({
  //       types: ["heading", "paragraph", "image"],
  //     }),
  //     Image.configure({
  //       inline: false,
  //       allowBase64: true,
  //     }),
  //     ResizeImage, // enable image resizing (optional)
  //   ],
  //   content: value || "",
  //   immediatelyRender: false,
  //   onUpdate: ({ editor }) => {
  //     onChange(editor.getHTML());
  //   },
  // });

  const editor = useEditor({
    extensions: [
      Document, 
      Paragraph,
      Text,
      StarterKit,
      Dropcursor,
      TextAlign.configure({
        types: ["heading", "paragraph", "image"],
      }),
      
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      ResizeImage, // enable image resizing (optional)
      Placeholder.configure({
        placeholder: "Write your blog content...",
      }),
      BubbleMenuExtension.configure({
        element: document.createElement("div"), // required placeholder element
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const handleImageInsert = (url: string) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  if (!editor) return null;

  return (
    <div className="rounded-lg border p-3">

      <div className="mb-2 flex flex-wrap gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("bold") ? "bg-primary text-white" : "bg-gray-200"
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("italic") ? "bg-primary text-white" : "bg-gray-200"
          }`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded px-2 py-1 ${
            editor.isActive("strike") ? "bg-primary text-white" : "bg-gray-200"
          }`}
        >
          S
        </button>

        
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className="rounded bg-gray-200 px-2 py-1"
        >
          ⬅️
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className="rounded bg-gray-200 px-2 py-1"
        >
          ⬆️
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className="rounded bg-gray-200 px-2 py-1"
        >
          ➡️
        </button>


        <button
          type="button"
          onClick={() => setShowMediaModal(true)}
          className="rounded bg-gray-200 px-2 py-1"
        >
          🖼️ Add Image
        </button>
      </div>

      <EditorContent
        editor={editor}
        className="prose min-h-[200px] max-w-none"
      />


      {showMediaModal && (
        <MediaPickerModal
          open={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onSelect={(items) => {
            if (items.length > 0) {
              handleImageInsert(items[0].file_path);
              setShowMediaModal(false);
            }
          }}
        />
      )}
    </div>
  );
}
 */
