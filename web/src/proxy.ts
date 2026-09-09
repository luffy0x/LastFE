import { NextResponse, type NextRequest } from "next/server";

import { CATEGORIES } from "@/features/content/categories";

const invalidQueryResponse = () =>
  new Response("Bad Request", {
    status: 400,
    headers: { "cache-control": "no-store" },
  });

export function proxy(request: NextRequest): Response {
  const regionSlug = request.nextUrl.pathname.split("/")[2];
  const category = CATEGORIES.find(
    (candidate) => candidate.slug === regionSlug && candidate.enabled,
  );
  if (!category) return NextResponse.next();

  const allowedKeys = new Set(["q", "page", ...category.filterKeys]);
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
