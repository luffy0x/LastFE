import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export function openDatabase(path: string): SqliteDatabase {
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  return database;
}
