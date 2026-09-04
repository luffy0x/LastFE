import { describe, expect, it } from "vitest";

import { openDatabase, type SqliteDatabase } from "./client";
import * as migrationModule from "./migrate";
import { migrationSql } from "./migrations/0001-content";
import { moderationOrderingMigrationSql } from "./migrations/0002-moderation-ordering";
import { moderationSequenceMigrationSql } from "./migrations/0003-moderation-sequence";
import { moderationAuthorityMigrationSql } from "./migrations/0004-moderation-authority";

type InitializeDatabase = <T>(
  path: string,
  initialize: (database: SqliteDatabase) => T,
) => T;
type InitializeDatabaseAsync = <T>(
  path: string,
  initialize: (database: SqliteDatabase) => Promise<T>,
) => Promise<T>;

function initializeFunctions(): {
  initializeDatabase: InitializeDatabase;
  initializeDatabaseAsync: InitializeDatabaseAsync;
} {
  const candidate = migrationModule as typeof migrationModule & {
    initializeDatabase?: InitializeDatabase;
    initializeDatabaseAsync?: InitializeDatabaseAsync;
  };
  expect(candidate.initializeDatabase).toBeTypeOf("function");
  expect(candidate.initializeDatabaseAsync).toBeTypeOf("function");
  if (!candidate.initializeDatabase || !candidate.initializeDatabaseAsync) {
    throw new Error("database initialization helpers are unavailable");
  }
  return {
    initializeDatabase: candidate.initializeDatabase,
    initializeDatabaseAsync: candidate.initializeDatabaseAsync,
  };
}

function seedVersionOne(database: SqliteDatabase): void {
  database.exec(migrationSql);
  database
    .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)")
    .run("2026-09-01T00:00:00.000Z");
}

function seedVersionTwo(database: SqliteDatabase): void {
  seedVersionOne(database);
  database.exec(moderationOrderingMigrationSql);
  database
    .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)")
    .run("2026-09-01T00:01:00.000Z");
}

function seedVersionThreeWithoutAuthority(database: SqliteDatabase): void {
  seedVersionTwo(database);
  database.exec(moderationSequenceMigrationSql);
  database
    .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)")
    .run("2026-09-01T00:02:00.000Z");
}

function seedVersionFour(database: SqliteDatabase): void {
  seedVersionThreeWithoutAuthority(database);
  database.exec(moderationAuthorityMigrationSql);
  database
    .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?)")
    .run("2026-09-01T00:03:00.000Z");
}

describe("database initialization ownership", () => {
  it("closes a migrated database when synchronous initialization throws", () => {
    const { initializeDatabase } = initializeFunctions();
    let opened: SqliteDatabase | undefined;

    expect(() =>
      initializeDatabase(":memory:", (database) => {
        opened = database;
        throw new Error("later initialization failed");
      }),
    ).toThrow("later initialization failed");
    expect(opened?.open).toBe(false);
  });

  it("closes a migrated database when asynchronous initialization rejects", async () => {
    const { initializeDatabaseAsync } = initializeFunctions();
    let opened: SqliteDatabase | undefined;

    await expect(
      initializeDatabaseAsync(":memory:", async (database) => {
        opened = database;
        throw new Error("dynamic import failed");
      }),
    ).rejects.toThrow("dynamic import failed");
    expect(opened?.open).toBe(false);
  });
});

describe("migrate", () => {
  it("upgrades a version-one database through the latest version and remains rerunnable", () => {
    const database = openDatabase(":memory:");
    seedVersionOne(database);
    database
      .prepare(
        `INSERT INTO moderation_issue_states (
          github_issue_number, status, updated_at
        ) VALUES (?, 'withdrawn', ?)`,
      )
      .run(101, "2026-09-01T08:00:00.000Z");

    migrationModule.migrate(database);
    migrationModule.migrate(database);

    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
    expect(
      database
        .prepare(
          `SELECT decision, updated_at, snapshot_identity, authoritative,
                  review_event_created_at, review_event_id
           FROM moderation_issue_states
           WHERE github_issue_number = 101`,
        )
        .get(),
    ).toEqual({
      decision: "withdrawn",
      updated_at: "2026-09-01T08:00:00.000Z",
      snapshot_identity: "legacy:withdrawn:2026-09-01T08:00:00.000Z",
      authoritative: 0,
      review_event_created_at: null,
      review_event_id: null,
    });
    database.close();
  });

  it("upgrades a version-two moderation state without rewriting it", () => {
    const database = openDatabase(":memory:");
    seedVersionTwo(database);
    database
      .prepare(
        `INSERT INTO moderation_issue_states (
          github_issue_number, decision, updated_at, snapshot_identity
        ) VALUES (?, 'withdrawn', ?, ?)`,
      )
      .run(202, "2026-09-01T09:00:00.000Z", "withdrawal-before-sequence");

    migrationModule.migrate(database);
    migrationModule.migrate(database);

    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
    expect(
      database
        .prepare(
          `SELECT decision, updated_at, snapshot_identity, authoritative,
                  review_event_created_at, review_event_id
           FROM moderation_issue_states
           WHERE github_issue_number = 202`,
        )
        .get(),
    ).toEqual({
      decision: "withdrawn",
      updated_at: "2026-09-01T09:00:00.000Z",
      snapshot_identity: "withdrawal-before-sequence",
      authoritative: 0,
      review_event_created_at: null,
      review_event_id: null,
    });
    database.close();
  });

  it("upgrades a historical version-three database and backfills only complete review sequences", () => {
    const database = openDatabase(":memory:");
    seedVersionThreeWithoutAuthority(database);
    const insertHistoricalState = database.prepare(
      `INSERT INTO moderation_issue_states (
        github_issue_number, decision, updated_at, snapshot_identity,
        review_event_created_at, review_event_id
      ) VALUES (?, 'withdrawn', ?, ?, ?, ?)`,
    );
    insertHistoricalState.run(
      303,
      "2026-09-01T10:00:00.000Z",
      "historical-v3-complete",
      "2026-09-01T10:00:00.000Z",
      "9002",
    );
    insertHistoricalState.run(
      304,
      "2026-09-01T10:01:00.000Z",
      "historical-v3-created-at-only",
      "2026-09-01T10:01:00.000Z",
      null,
    );
    insertHistoricalState.run(
      305,
      "2026-09-01T10:02:00.000Z",
      "historical-v3-event-id-only",
      null,
      "9003",
    );
    insertHistoricalState.run(
      306,
      "2026-09-01T10:03:00.000Z",
      "historical-v3-no-sequence",
      null,
      null,
    );

    migrationModule.migrate(database);
    migrationModule.migrate(database);

    expect(
      database
        .prepare(
          `SELECT github_issue_number, authoritative
           FROM moderation_issue_states
           ORDER BY github_issue_number`,
        )
        .all(),
    ).toEqual([
      { github_issue_number: 303, authoritative: 1 },
      { github_issue_number: 304, authoritative: 0 },
      { github_issue_number: 305, authoritative: 0 },
      { github_issue_number: 306, authoritative: 0 },
    ]);
    expect(
      database
        .prepare(
          `SELECT decision, snapshot_identity, review_event_created_at,
                  review_event_id
           FROM moderation_issue_states
           WHERE github_issue_number = 303`,
        )
        .get(),
    ).toEqual({
      decision: "withdrawn",
      snapshot_identity: "historical-v3-complete",
      review_event_created_at: "2026-09-01T10:00:00.000Z",
      review_event_id: "9002",
    });
    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
    database.close();
  });

  it("upgrades a historical version-four database and backfills complete review sequences", () => {
    const database = openDatabase(":memory:");
    seedVersionFour(database);
    database
      .prepare(
        `INSERT INTO moderation_issue_states (
          github_issue_number, decision, updated_at, snapshot_identity,
          review_event_created_at, review_event_id, authoritative
        ) VALUES (?, 'withdrawn', ?, ?, ?, ?, 0)`,
      )
      .run(
        403,
        "2026-09-01T11:00:00.000Z",
        "historical-v4-complete",
        "2026-09-01T11:00:00.000Z",
        "9010",
      );

    migrationModule.migrate(database);
    migrationModule.migrate(database);

    expect(
      database
        .prepare(
          `SELECT decision, snapshot_identity, review_event_created_at,
                  review_event_id, authoritative
           FROM moderation_issue_states
           WHERE github_issue_number = 403`,
        )
        .get(),
    ).toEqual({
      decision: "withdrawn",
      snapshot_identity: "historical-v4-complete",
      review_event_created_at: "2026-09-01T11:00:00.000Z",
      review_event_id: "9010",
      authoritative: 1,
    });
    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
    database.close();
  });

  it("rolls back version-five backfill and succeeds on retry and rerun", () => {
    const database = openDatabase(":memory:");
    seedVersionFour(database);
    database
      .prepare(
        `INSERT INTO moderation_issue_states (
          github_issue_number, decision, updated_at, snapshot_identity,
          review_event_created_at, review_event_id, authoritative
        ) VALUES (?, 'withdrawn', ?, ?, ?, ?, 0)`,
      )
      .run(
        503,
        "2026-09-01T12:00:00.000Z",
        "rollback-v5-complete",
        "2026-09-01T12:00:00.000Z",
        "9020",
      );
    database.exec(`CREATE TRIGGER fail_version_five
      BEFORE INSERT ON schema_migrations
      WHEN NEW.version = 5
      BEGIN
        SELECT RAISE(ABORT, 'forced version five failure');
      END;`);

    expect(() => migrationModule.migrate(database)).toThrow(
      "forced version five failure",
    );
    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
    ]);
    expect(
      database
        .prepare(
          "SELECT authoritative FROM moderation_issue_states WHERE github_issue_number = 503",
        )
        .get(),
    ).toEqual({ authoritative: 0 });

    database.exec("DROP TRIGGER fail_version_five");
    migrationModule.migrate(database);
    migrationModule.migrate(database);

    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
    expect(
      database
        .prepare(
          "SELECT authoritative FROM moderation_issue_states WHERE github_issue_number = 503",
        )
        .get(),
    ).toEqual({ authoritative: 1 });
    database.close();
  });

  it("rolls back a failed version-four migration and succeeds on retry and rerun", () => {
    const database = openDatabase(":memory:");
    seedVersionThreeWithoutAuthority(database);
    database.exec(`CREATE TRIGGER fail_version_four
      BEFORE INSERT ON schema_migrations
      WHEN NEW.version = 4
      BEGIN
        SELECT RAISE(ABORT, 'forced version four failure');
      END;`);

    expect(() => migrationModule.migrate(database)).toThrow(
      "forced version four failure",
    );
    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
    expect(
      database
        .prepare("SELECT name FROM pragma_table_info('moderation_issue_states')")
        .all(),
    ).not.toContainEqual({ name: "authoritative" });

    database.exec("DROP TRIGGER fail_version_four");
    migrationModule.migrate(database);
    migrationModule.migrate(database);

    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
    const authorityColumns = database
      .prepare("SELECT name FROM pragma_table_info('moderation_issue_states')")
      .all() as Array<{ name: string }>;
    expect(
      authorityColumns.filter(({ name }) => name === "authoritative"),
    ).toEqual([{ name: "authoritative" }]);
    database.close();
  });

  it("rolls back a failure after the first version-three statement and retries once", () => {
    const database = openDatabase(":memory:");
    seedVersionTwo(database);
    database.exec(
      "ALTER TABLE moderation_issue_states ADD COLUMN review_event_id TEXT",
    );

    expect(() => migrationModule.migrate(database)).toThrow(
      "duplicate column name: review_event_id",
    );
    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([{ version: 1 }, { version: 2 }]);
    const rolledBackColumns = database
      .prepare("SELECT name FROM pragma_table_info('moderation_issue_states')")
      .all();
    expect(rolledBackColumns).not.toContainEqual({
      name: "review_event_created_at",
    });
    expect(rolledBackColumns).not.toContainEqual({ name: "authoritative" });

    database.exec(
      "ALTER TABLE moderation_issue_states DROP COLUMN review_event_id",
    );
    migrationModule.migrate(database);
    migrationModule.migrate(database);

    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
    const sequenceColumns = database
      .prepare("SELECT name FROM pragma_table_info('moderation_issue_states')")
      .all() as Array<{ name: string }>;
    const matchingSequenceColumns = sequenceColumns
      .filter(({ name }) =>
        ["review_event_created_at", "review_event_id", "authoritative"].includes(name),
      );
    expect(matchingSequenceColumns).toEqual([
      { name: "review_event_created_at" },
      { name: "review_event_id" },
      { name: "authoritative" },
    ]);
    database.close();
  });

  it("rolls back a failed migration and succeeds on retry", () => {
    const database = openDatabase(":memory:");
    seedVersionOne(database);
    database.exec(`CREATE TRIGGER fail_version_two
      BEFORE INSERT ON schema_migrations
      WHEN NEW.version = 2
      BEGIN
        SELECT RAISE(ABORT, 'forced migration failure');
      END;`);

    expect(() => migrationModule.migrate(database)).toThrow(
      "forced migration failure",
    );
    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([{ version: 1 }]);
    expect(
      database
        .prepare("SELECT name FROM pragma_table_info('moderation_issue_states')")
        .all(),
    ).toContainEqual({ name: "status" });

    database.exec("DROP TRIGGER fail_version_two");
    migrationModule.migrate(database);
    expect(
      database
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
      { version: 4 },
      { version: 5 },
    ]);
    database.close();
  });
});
