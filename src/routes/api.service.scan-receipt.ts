import { createFileRoute } from "@tanstack/react-router";
import { currentUser } from "@/services/server/accounts";
import { canUseAiDocumentScan, scanServiceDocument } from "@/services/server/document-scanner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);

export const Route = createFileRoute("/api/service/scan-receipt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let user;
        try {
          user = await currentUser(request);
        } catch {
          return Response.json({ error: "Sign in to scan service documents." }, { status: 401 });
        }
        if (!canUseAiDocumentScan(user)) {
          return Response.json({
            error: "FEATURE_LOCKED",
            message: "AI Scanning requires a Pro DIY, Pro Modder, or Verified Workshop subscription.",
          }, { status: 403 });
        }
        try {
          const contentLength = Number(request.headers.get("content-length"));
          if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 128_000) {
            return Response.json({ error: "Choose an image no larger than 10 MB." }, { status: 413 });
          }
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) {
            return Response.json({ error: "Choose a PNG, JPEG, WEBP, HEIC or HEIF image." }, { status: 400 });
          }
          if (file.size === 0 || file.size > MAX_FILE_SIZE) {
            return Response.json({ error: "Choose an image no larger than 10 MB." }, { status: 413 });
          }
          const fields = await scanServiceDocument({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type });
          return Response.json({ fields });
        } catch (error) {
          console.error("AI service-document scan failed:", error);
          return Response.json({
            error: "Unable to auto-scan document right now. Please enter details manually.",
            manual_entry: true,
          }, { status: 500 });
        }
      },
    },
  },
});
