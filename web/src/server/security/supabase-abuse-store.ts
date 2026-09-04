export type AbuseStore = {
  reserve(input: {
    sourceHash: string;
    fingerprint: string;
    now: Date;
  }): Promise<{ reservationId: string }>;
  recordSuccess(reservationId: string, now: Date): Promise<void>;
  release(reservationId: string): Promise<void>;
};

export class AbuseStoreError extends Error {
  readonly code: "DUPLICATE" | "RATE_LIMIT" | "INVALID_RESERVATION";

  constructor(code: AbuseStoreError["code"]) {
    super(code);
    this.name = "AbuseStoreError";
    this.code = code;
  }
}

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

type DeleteBuilder = {
  eq(column: string, value: string): DeleteBuilder;
  then<TResult1 = RpcResult, TResult2 = never>(
    onfulfilled?: ((value: RpcResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type SupabaseAbuseClient = {
  rpc(name: string, parameters: Record<string, string>): PromiseLike<RpcResult>;
  from(table: string): {
    delete(): DeleteBuilder;
  };
};

function throwRpcError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function createSupabaseAbuseStore(client: SupabaseAbuseClient): AbuseStore {
  return {
    async reserve(input) {
      const result = await client.rpc("reserve_submission", {
        p_source_hash: input.sourceHash,
        p_fingerprint: input.fingerprint,
        p_now: input.now.toISOString(),
      });
      throwRpcError(result.error, "Supabase submission reservation failed");

      if (result.data === "duplicate") throw new AbuseStoreError("DUPLICATE");
      if (result.data === "rate_limit") throw new AbuseStoreError("RATE_LIMIT");
      if (result.data !== "reserved") {
        throw new Error("Supabase submission reservation returned an unknown status");
      }

      return { reservationId: input.fingerprint };
    },

    async recordSuccess(reservationId, now) {
      const result = await client.rpc("record_submission_success", {
        p_fingerprint: reservationId,
        p_now: now.toISOString(),
      });
      throwRpcError(result.error, "Supabase submission success recording failed");

      if (result.data !== "submitted") {
        throw new AbuseStoreError("INVALID_RESERVATION");
      }
    },

    async release(reservationId) {
      const result = await client
        .from("submission_fingerprints")
        .delete()
        .eq("fingerprint", reservationId)
        .eq("state", "reserved");
      throwRpcError(result.error, "Supabase submission reservation release failed");
    },
  };
}
