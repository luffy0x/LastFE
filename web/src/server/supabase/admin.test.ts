import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getSupabaseAdmin } from "./admin";
import { requireServerEnv } from "./env";

describe("Supabase server configuration", () => {
  it("rejects an unset server environment variable", () => {
    vi.stubEnv("SUPABASE_URL", "");

    expect(() => requireServerEnv("SUPABASE_URL")).toThrow(
      "Missing required server environment variable: SUPABASE_URL",
    );
  });

  it("creates an admin client from server-only credentials", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

    const client = getSupabaseAdmin();

    expect(client).toBeDefined();
  });
});

describe("Supabase migration contract", () => {
  it("defines published content and moderation idempotency tables", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "supabase/migrations/001_initial_schema.sql"),
      "utf8",
    );

    expect(migration).toMatch(/create table if not exists public\.content/i);
    expect(migration).toMatch(/create table if not exists public\.moderation_events/i);
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/status\s+text\s+not null/i);
  });
});
