import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "@/server/db/client";

const RESERVATION_TTL_MS = 5 * 60 * 1000;
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 10;

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

function isConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("SQLITE_CONSTRAINT")
  );
}

export function createSqliteAbuseStore(database: SqliteDatabase): AbuseStore {
  const reserveTransaction = database.transaction(
    (input: { sourceHash: string; fingerprint: string; now: Date }) => {
      const nowIso = input.now.toISOString();
      const eventCutoff = new Date(
        input.now.getTime() - RATE_WINDOW_MS,
      ).toISOString();

      database
        .prepare("DELETE FROM submission_fingerprints WHERE expires_at <= ?")
        .run(nowIso);
      database
        .prepare("DELETE FROM successful_submission_events WHERE succeeded_at <= ?")
        .run(eventCutoff);

      const successful = database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM successful_submission_events
           WHERE source_hash = ? AND succeeded_at > ?`,
        )
        .get(input.sourceHash, eventCutoff) as { count: number };
      const active = database
        .prepare(
          `SELECT COUNT(*) AS count
           FROM submission_fingerprints
           WHERE source_hash = ? AND state = 'reserved' AND expires_at > ?`,
        )
        .get(input.sourceHash, nowIso) as { count: number };

      if (successful.count + active.count >= RATE_LIMIT) {
        return { error: "RATE_LIMIT" as const };
      }

      const reservationId = randomUUID();
      try {
        database
          .prepare(
            `INSERT INTO submission_fingerprints
              (fingerprint, source_hash, reservation_id, state, expires_at)
             VALUES (?, ?, ?, 'reserved', ?)`,
          )
          .run(
            input.fingerprint,
            input.sourceHash,
            reservationId,
            new Date(input.now.getTime() + RESERVATION_TTL_MS).toISOString(),
          );
      } catch (error) {
        if (
          isConstraintError(error) &&
          database
            .prepare("SELECT 1 FROM submission_fingerprints WHERE fingerprint = ?")
            .get(input.fingerprint)
        ) {
          return { error: "DUPLICATE" as const };
        }
        throw error;
      }

      return { reservationId, error: undefined };
    },
  );

  const successTransaction = database.transaction(
    (reservationId: string, now: Date) => {
      const nowIso = now.toISOString();
      const promoted = database
        .prepare(
          `UPDATE submission_fingerprints
           SET state = 'submitted', expires_at = ?
           WHERE reservation_id = ? AND state = 'reserved' AND expires_at > ?
           RETURNING source_hash`,
        )
        .get(
          new Date(now.getTime() + DEDUPE_TTL_MS).toISOString(),
          reservationId,
          nowIso,
        ) as { source_hash: string } | undefined;

      if (!promoted) throw new AbuseStoreError("INVALID_RESERVATION");

      database
        .prepare(
          `INSERT INTO successful_submission_events (source_hash, succeeded_at)
           VALUES (?, ?)`,
        )
        .run(promoted.source_hash, nowIso);
    },
  );

  return {
    async reserve(input) {
      const result = reserveTransaction(input);
      if (result.error) throw new AbuseStoreError(result.error);
      return { reservationId: result.reservationId };
    },
    async recordSuccess(reservationId, now) {
      successTransaction(reservationId, now);
    },
    async release(reservationId) {
      database
        .prepare(
          "DELETE FROM submission_fingerprints WHERE reservation_id = ? AND state = 'reserved'",
        )
        .run(reservationId);
    },
  };
}
