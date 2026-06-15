// src/components/FormElements/InputGroup/ckeditor.tsx
"use client";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Font,
  Link,
  List,
  Indent,
  IndentBlock,
  BlockQuote,
  Image,
  ImageBlock,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  ImageInsert,
  LinkImage,
  // GeneralHtmlSupport,
  FileRepository,
  UploadAdapter,
} from "ckeditor5";

// import {
//   Image,
//   ImageBlock,
//   ImageCaption,
//   ImageResize,
//   ImageStyle,
//   ImageToolbar,
//   ImageUpload,
//   ImageInsert, // ✅ add this for “insertImage” button
//   // LinkImage,
// } from "@ckeditor/ckeditor5-image"; // ✅ use correct package

import "ckeditor5/ckeditor5.css";

interface CustomEditorProps {
  name: string;
  value?: string;
  placeholder?: string;
  onChange?: (name: string, data: string) => void;
  onOpenMediaModal?: () => void;
}

// Example upload adapter (you can customize to upload to your backend)
/* class MyUploadAdapter {
  loader: any;

  constructor(loader: any) {
    this.loader = loader;
  }

  async upload() {
    const file = await this.loader.file;
    const data = new FormData();
    data.append("file", file);

    // Change this to your actual API endpoint for uploads
    const response = await fetch("/api/upload", {
      method: "POST",
      body: data,
    });
    const result = await response.json();

    return {
      default: result.url, // Must return { default: 'image_url' }
    };
  }

  abort() {
    // Handle abort if necessary
  }
} */

function CustomEditor({
  name,
  value,
  onChange,
  placeholder,
  onOpenMediaModal,
}: CustomEditorProps) {
  const editorConfig = {
    licenseKey:
      "eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3NjM2ODMxOTksImp0aSI6IjM4MDI1NGJmLTEwMWItNDk5Ny05NDM4LTU1NmIxYjEyMDNhYiIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6IjgyZTA2ODU4In0.7T7BFdG5lxiic-CDAPBZxdIb1PBk9FnxEbYiTo3ypDR_QoWq8nb0nALE1_bVEIMaT-2zRyNAHuAlqbV7lBKsew",
    plugins: [
      Essentials,
      Paragraph,
      Heading,
      Bold,
      Italic,
      Font,
      Link,
      List,
      Indent,
      IndentBlock,
      BlockQuote,
      Image,
      ImageToolbar,
      ImageCaption,
      ImageStyle,
      ImageResize,
      LinkImage,
      ImageBlock,
      ImageInsert,
      ImageUpload,
      // GeneralHtmlSupport,
      FileRepository, // ✅ required for custom upload
    ],
    toolbar: [
      "undo",
      "redo",
      "|",
      "heading",
      "|",
      "bold",
      "italic",
      "|",
      "link",
      "bulletedList",
      "numberedList",
      "blockQuote",
      "|",
      "insertImage",
      "openMediaLibrary",
    ],
    image: {
      toolbar: [
        "imageStyle:inline",
        "imageStyle:block",
        "imageStyle:side",
        "|",
        "toggleImageCaption",
        "imageTextAlternative",
      ],
    },
    // htmlSupport: {
    //   allow: [
    //     {
    //       name: /.*/,
    //       attributes: true,
    //       classes: true,
    //       styles: true,
    //     },
    //   ],
    //   disallow: [
    //     /* HTML features to disallow. */
    //   ],
    // },
    // extraPlugins: [
    //   function (editor: any) {
    //     editor.plugins.get("FileRepository").createUploadAdapter = (loader: any) => {
    //       return new MyUploadAdapter(loader);
    //     };
    //   },
    // ],
    placeholder,
  };

  const handleReady = (editor: any) => {
    // ✅ Add “Media Library” custom button
    editor.ui.componentFactory.add("openMediaLibrary", (locale: any) => {
      const view = new editor.ui.button.ButtonView(locale);
      view.set({
        label: "Media Library",
        tooltip: true,
        withText: true,
      });
      view.on("execute", () => {
        onOpenMediaModal?.();
      });
      return view;
    });
  };

  return (
    <div className="w-full">
      <CKEditor
        editor={ClassicEditor}
        config={editorConfig}
        data={value || ""}
        onReady={handleReady}
        onChange={(_, editor) => {
          const data = editor.getData();
          onChange?.(name, data);
        }}
      />
    </div>
  );
}

export default CustomEditor;
