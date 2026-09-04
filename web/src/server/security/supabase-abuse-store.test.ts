import { describe, expect, it, vi } from "vitest";

import {
  AbuseStoreError,
  createSupabaseAbuseStore,
  type SupabaseAbuseClient,
} from "./supabase-abuse-store";

function clientWithRpc(data: unknown, error: { message: string } | null = null) {
  const result = { data, error };
  const deleteBuilder = {
    eq: vi.fn(() => deleteBuilder),
    then: (
      onfulfilled?: (value: typeof result) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };

  return {
    client: {
      rpc: vi.fn(() => Promise.resolve(result)),
      from: vi.fn(() => ({ delete: vi.fn(() => deleteBuilder) })),
    } as unknown as SupabaseAbuseClient,
    deleteBuilder,
  };
}

describe("createSupabaseAbuseStore", () => {
  it("reserves a submission fingerprint through Supabase RPC", async () => {
    const { client } = clientWithRpc("reserved");
    const store = createSupabaseAbuseStore(client);
    const now = new Date("2026-09-04T08:00:00.000Z");

    await expect(
      store.reserve({ sourceHash: "source", fingerprint: "fingerprint", now }),
    ).resolves.toEqual({ reservationId: "fingerprint" });

    expect(client.rpc).toHaveBeenCalledWith("reserve_submission", {
      p_source_hash: "source",
      p_fingerprint: "fingerprint",
      p_now: "2026-09-04T08:00:00.000Z",
    });
  });

  it("maps duplicate and rate-limit statuses to typed errors", async () => {
    await expect(
      createSupabaseAbuseStore(clientWithRpc("duplicate").client).reserve({
        sourceHash: "source",
        fingerprint: "fingerprint",
        now: new Date("2026-09-04T08:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE" });

    await expect(
      createSupabaseAbuseStore(clientWithRpc("rate_limit").client).reserve({
        sourceHash: "source",
        fingerprint: "other",
        now: new Date("2026-09-04T08:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT" });
  });

  it("records success and releases abandoned reservations", async () => {
    const { client, deleteBuilder } = clientWithRpc("submitted");
    const store = createSupabaseAbuseStore(client);

    await store.recordSuccess("fingerprint", new Date("2026-09-04T08:00:00.000Z"));
    await store.release("fingerprint");

    expect(client.rpc).toHaveBeenCalledWith("record_submission_success", {
      p_fingerprint: "fingerprint",
      p_now: "2026-09-04T08:00:00.000Z",
    });
    expect(client.from).toHaveBeenCalledWith("submission_fingerprints");
    expect(deleteBuilder.eq).toHaveBeenCalledWith("fingerprint", "fingerprint");
    expect(deleteBuilder.eq).toHaveBeenCalledWith("state", "reserved");
  });

  it("rejects invalid success reservations", async () => {
    await expect(
      createSupabaseAbuseStore(clientWithRpc("invalid_reservation").client).recordSuccess(
        "missing",
        new Date("2026-09-04T08:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(AbuseStoreError);
  });
});
