// apps/admin/app/api/uploadthing/core.ts

import { createUploadthing, type FileRouter } from "uploadthing/next";
import pool from "@/lib/db";

const f = createUploadthing();

export const mediaRouter = {
  productImage: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 25,
    },
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
    "application/msword": {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
  })
    .middleware(async ({ req }) => {
      const isCallback = req.headers.get("x-uploadthing-hook");

      // UploadThing callback allow
      if (isCallback) {
        return { userId: "system" };
      }

      // JWT AUTH REMOVED — now all requests are allowed
      return {
        userId: "anonymous",
      };
    })
    .onUploadComplete(async ({ file, metadata }) => {
      const fileUrl = file.ufsUrl || file.url;

      if (!fileUrl || !file.name) {
        throw new Error("Invalid file upload");
      }

      const cleanFileName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.\-_]/g, "-")
        .replace(/-+/g, "-");

      return {
        name: file.name,
        url: file.ufsUrl || file.url,
        type: file.type,
      };
    }),
} satisfies FileRouter;

export type MediaRouter = typeof mediaRouter;
