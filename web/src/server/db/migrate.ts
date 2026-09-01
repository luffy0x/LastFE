import type { SqliteDatabase } from "./client";
// @ts-expect-error -- Vite loads migration assets with the raw-query suffix.
import migrationSql from "./migrations/0001_content.sql?raw";

export function migrate(database: SqliteDatabase): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );

  const applied = database
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(1);
  if (applied) return;

  database.transaction(() => {
    database.exec(
      migrationSql.replace(
        "CREATE TABLE schema_migrations",
        "CREATE TABLE IF NOT EXISTS schema_migrations",
      ),
    );
    database
      .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(1, new Date().toISOString());
  })();
}
