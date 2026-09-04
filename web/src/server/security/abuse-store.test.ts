import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, type SqliteDatabase } from "@/server/db/client";
import { migrate } from "@/server/db/migrate";
import {
  AbuseStoreError,
  createSqliteAbuseStore,
} from "./abuse-store";

const NOW = new Date("2026-09-01T08:00:00.000Z");

const databases: SqliteDatabase[] = [];

function setup() {
  const database = openDatabase(":memory:");
  databases.push(database);
  migrate(database);
  return { database, store: createSqliteAbuseStore(database) };
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("SQLite abuse store", () => {
  it("creates a five-minute reservation", async () => {
    const { database, store } = setup();

    const reservation = await store.reserve({
      sourceHash: "source-a",
      fingerprint: "fingerprint-a",
      now: NOW,
    });

    expect(reservation.reservationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      database
        .prepare(
          "SELECT source_hash, reservation_id, state, expires_at FROM submission_fingerprints",
        )
        .get(),
    ).toEqual({
      source_hash: "source-a",
      reservation_id: reservation.reservationId,
      state: "reserved",
      expires_at: "2026-09-01T08:05:00.000Z",
    });
  });

  it("rejects an unexpired matching fingerprint through the unique constraint", async () => {
    const { store } = setup();
    const input = {
      sourceHash: "source-a",
      fingerprint: "same-fingerprint",
      now: NOW,
    };

    const results = await Promise.allSettled([
      store.reserve(input),
      store.reserve(input),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ code: "DUPLICATE" }),
    });
  });

  it("removes fingerprints at their exact expiry boundary", async () => {
    const { database, store } = setup();
    database
      .prepare(
        `INSERT INTO submission_fingerprints
          (fingerprint, source_hash, reservation_id, state, expires_at)
         VALUES (?, ?, ?, 'submitted', ?)`,
      )
      .run(
        "expired-fingerprint",
        "old-source",
        "expired-reservation",
        NOW.toISOString(),
      );

    await expect(
      store.reserve({
        sourceHash: "source-a",
        fingerprint: "expired-fingerprint",
        now: NOW,
      }),
    ).resolves.toEqual({ reservationId: expect.any(String) });

    expect(
      database
        .prepare("SELECT source_hash, state FROM submission_fingerprints")
        .all(),
    ).toEqual([{ source_hash: "source-a", state: "reserved" }]);
  });

  it("counts successful events plus active reservations within one hour", async () => {
    const { database, store } = setup();
    const insertEvent = database.prepare(
      "INSERT INTO successful_submission_events (source_hash, succeeded_at) VALUES (?, ?)",
    );
    insertEvent.run("source-a", "2026-09-01T07:00:00.000Z");
    for (let minute = 1; minute <= 9; minute += 1) {
      insertEvent.run("source-a", `2026-09-01T07:${String(minute).padStart(2, "0")}:00.000Z`);
    }
    database
      .prepare(
        `INSERT INTO submission_fingerprints
          (fingerprint, source_hash, reservation_id, state, expires_at)
         VALUES (?, ?, ?, 'reserved', ?)`,
      )
      .run(
        "active-fingerprint",
        "source-a",
        "active-reservation",
        "2026-09-01T08:00:01.000Z",
      );
    database
      .prepare(
        `INSERT INTO submission_fingerprints
          (fingerprint, source_hash, reservation_id, state, expires_at)
         VALUES (?, ?, ?, 'reserved', ?)`,
      )
      .run(
        "expired-reservation-fingerprint",
        "source-a",
        "expired-reservation",
        NOW.toISOString(),
      );

    await expect(
      store.reserve({
        sourceHash: "source-a",
        fingerprint: "next-fingerprint",
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT" });

    expect(
      database
        .prepare(
          "SELECT succeeded_at FROM successful_submission_events ORDER BY succeeded_at",
        )
        .all(),
    ).toHaveLength(9);
    expect(
      database
        .prepare(
          "SELECT reservation_id FROM submission_fingerprints WHERE state = 'reserved'",
        )
        .all(),
    ).toEqual([{ reservation_id: "active-reservation" }]);
  });

  it("atomically promotes a reservation for 24 hours and appends success", async () => {
    const { database, store } = setup();
    const { reservationId } = await store.reserve({
      sourceHash: "source-a",
      fingerprint: "fingerprint-a",
      now: NOW,
    });

    await store.recordSuccess(reservationId, NOW);

    expect(
      database
        .prepare(
          "SELECT state, expires_at FROM submission_fingerprints WHERE reservation_id = ?",
        )
        .get(reservationId),
    ).toEqual({
      state: "submitted",
      expires_at: "2026-09-02T08:00:00.000Z",
    });
    expect(
      database
        .prepare(
          "SELECT source_hash, succeeded_at FROM successful_submission_events",
        )
        .get(),
    ).toEqual({
      source_hash: "source-a",
      succeeded_at: NOW.toISOString(),
    });
  });

  it("rolls back promotion when the successful event insert fails", async () => {
    const { database, store } = setup();
    const { reservationId } = await store.reserve({
      sourceHash: "source-a",
      fingerprint: "fingerprint-a",
      now: NOW,
    });
    database.exec(`
      CREATE TRIGGER reject_success_event
      BEFORE INSERT ON successful_submission_events
      BEGIN
        SELECT RAISE(ABORT, 'test failure');
      END;
    `);

    await expect(store.recordSuccess(reservationId, NOW)).rejects.toThrow();

    expect(
      database
        .prepare(
          "SELECT state, expires_at FROM submission_fingerprints WHERE reservation_id = ?",
        )
        .get(reservationId),
    ).toEqual({
      state: "reserved",
      expires_at: "2026-09-01T08:05:00.000Z",
    });
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM successful_submission_events").get(),
    ).toEqual({ count: 0 });
  });

  it("rolls back expired-row cleanup when reservation insertion fails", async () => {
    const { database, store } = setup();
    database
      .prepare(
        `INSERT INTO submission_fingerprints
          (fingerprint, source_hash, reservation_id, state, expires_at)
         VALUES (?, ?, ?, 'reserved', ?)`,
      )
      .run("old", "source-a", "old-reservation", NOW.toISOString());
    database.exec(`
      CREATE TRIGGER reject_reservation
      BEFORE INSERT ON submission_fingerprints
      BEGIN
        SELECT RAISE(ABORT, 'test failure');
      END;
    `);

    await expect(
      store.reserve({
        sourceHash: "source-a",
        fingerprint: "new",
        now: NOW,
      }),
    ).rejects.toThrow();

    expect(
      database
        .prepare("SELECT reservation_id FROM submission_fingerprints")
        .all(),
    ).toEqual([{ reservation_id: "old-reservation" }]);
  });

  it("releases only an active reservation", async () => {
    const { database, store } = setup();
    const active = await store.reserve({
      sourceHash: "source-a",
      fingerprint: "active",
      now: NOW,
    });
    const submitted = await store.reserve({
      sourceHash: "source-b",
      fingerprint: "submitted",
      now: NOW,
    });
    await store.recordSuccess(submitted.reservationId, NOW);

    await store.release(active.reservationId);
    await store.release(submitted.reservationId);

    expect(
      database
        .prepare("SELECT reservation_id, state FROM submission_fingerprints")
        .all(),
    ).toEqual([{ reservation_id: submitted.reservationId, state: "submitted" }]);
  });

  it("fails closed for an unknown or already-promoted reservation", async () => {
    const { store } = setup();

    await expect(store.recordSuccess("missing", NOW)).rejects.toBeInstanceOf(
      AbuseStoreError,
    );
  });
});
