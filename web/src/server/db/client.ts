import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export type ReconciliationCursorStore = {
  read(name: string): Promise<string | null>;
  write(name: string, value: string): Promise<void>;
};

export function openDatabase(path: string): SqliteDatabase {
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  return database;
}

export function createReconciliationCursorStore(
  database: SqliteDatabase,
): ReconciliationCursorStore {
  return {
    async read(name) {
      const row = database
        .prepare("SELECT value FROM reconciliation_cursors WHERE name = ?")
        .get(name) as { value: string } | undefined;
      return row?.value ?? null;
    },
    async write(name, value) {
      database
        .prepare(
          `INSERT INTO reconciliation_cursors (name, value) VALUES (?, ?)
           ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
        )
        .run(name, value);
    },
  };
}
