import { jsonResponse } from "@/lib/http/json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return jsonResponse({
    status: "ok",
    service: "lab-platform",
    revision: process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
  });
}
