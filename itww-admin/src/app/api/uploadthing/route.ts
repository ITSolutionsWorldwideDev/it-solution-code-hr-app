// apps/admin/app/api/uploadthing/route.ts

import { createRouteHandler } from "uploadthing/next";
import { mediaRouter } from "./core";

// export const runtime = "nodejs";

console.log("🔥 UploadThing route file loaded");

export const { GET, POST } = createRouteHandler({
  router: mediaRouter,
});