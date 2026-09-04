import { getSupabaseAdmin } from "@/server/supabase/admin";

export const runtime = "nodejs";

type HealthBody = {
  status: "ok" | "unhealthy";
  checks: { app: "ok"; content: "fixture" | "supabase" | "configuration" | "query" };
};

export async function GET() {
  if (process.env.CONTENT_REPOSITORY !== "supabase") {
    return Response.json({
      status: "ok",
      checks: { app: "ok", content: "fixture" },
    } satisfies HealthBody);
  }

  try {
    const result = await getSupabaseAdmin()
      .from("content")
      .select("id", { count: "exact", head: true })
      .eq("status", "published");

    if (result.error) {
      return Response.json(
        { status: "unhealthy", checks: { app: "ok", content: "query" } } satisfies HealthBody,
        { status: 503 },
      );
    }

    return Response.json({
      status: "ok",
      checks: { app: "ok", content: "supabase" },
    } satisfies HealthBody);
  } catch {
    return Response.json(
      { status: "unhealthy", checks: { app: "ok", content: "configuration" } } satisfies HealthBody,
      { status: 503 },
    );
  }
}
