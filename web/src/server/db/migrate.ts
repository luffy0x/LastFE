import { openDatabase, type SqliteDatabase } from "./client";
import { migrationSql } from "./migrations/0001-content";
import { moderationOrderingMigrationSql } from "./migrations/0002-moderation-ordering";
import { moderationSequenceMigrationSql } from "./migrations/0003-moderation-sequence";

const migrations = [
  {
    version: 1,
    sql: migrationSql.replace(
      "CREATE TABLE schema_migrations",
      "CREATE TABLE IF NOT EXISTS schema_migrations",
    ),
  },
  { version: 2, sql: moderationOrderingMigrationSql },
  { version: 3, sql: moderationSequenceMigrationSql },
] as const;

export function migrate(database: SqliteDatabase): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );

  const applied = new Set(
    (database
      .prepare("SELECT version FROM schema_migrations")
      .all() as Array<{ version: number }>).map(({ version }) => version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    database.transaction(() => {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
    })();
  }
}

export function initializeDatabase<T>(
  path: string,
  initialize: (database: SqliteDatabase) => T,
): T {
  const database = openDatabase(path);
  try {
    migrate(database);
    return initialize(database);
  } catch (error) {
    try {
      database.close();
    } catch {
      // Preserve the initialization failure that prevented ownership transfer.
    }
    throw error;
  }
}

export async function initializeDatabaseAsync<T>(
  path: string,
  initialize: (database: SqliteDatabase) => Promise<T>,
): Promise<T> {
  const database = openDatabase(path);
  try {
    migrate(database);
    return await initialize(database);
  } catch (error) {
    try {
      database.close();
    } catch {
      // Preserve the initialization failure that prevented ownership transfer.
    }
    throw error;
  }
}
