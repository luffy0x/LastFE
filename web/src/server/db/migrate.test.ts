import { describe, expect, it } from "vitest";

import { openDatabase, type SqliteDatabase } from "./client";
import * as migrationModule from "./migrate";
import { migrationSql } from "./migrations/0001-content";

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
  it("upgrades a version-one database once and remains rerunnable", () => {
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
    ).toEqual([{ version: 1 }, { version: 2 }]);
    expect(
      database
        .prepare(
          `SELECT decision, updated_at, snapshot_identity
           FROM moderation_issue_states
           WHERE github_issue_number = 101`,
        )
        .get(),
    ).toEqual({
      decision: "withdrawn",
      updated_at: "2026-09-01T08:00:00.000Z",
      snapshot_identity: "legacy:withdrawn:2026-09-01T08:00:00.000Z",
    });
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
    ).toEqual([{ version: 1 }, { version: 2 }]);
    database.close();
  });
});
