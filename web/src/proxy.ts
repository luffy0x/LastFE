import { NextResponse, type NextRequest } from "next/server";

import { REGIONS } from "@/features/map/regions";

const invalidQueryResponse = () =>
  new Response("Bad Request", {
    status: 400,
    headers: { "cache-control": "no-store" },
  });

export function proxy(request: NextRequest): Response {
  const regionSlug = request.nextUrl.pathname.split("/")[2];
  const region = REGIONS.find(
    (candidate) => candidate.slug === regionSlug && candidate.enabled,
  );
  if (!region) return NextResponse.next();

  const allowedKeys = new Set(["q", "page", ...region.filterKeys]);
  for (const key of request.nextUrl.searchParams.keys()) {
    if (
      !allowedKeys.has(key) ||
      request.nextUrl.searchParams.getAll(key).length !== 1
    ) {
      return invalidQueryResponse();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/regions/:path*",
};
