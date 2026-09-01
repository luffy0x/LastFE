CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE TABLE contents (
  id TEXT PRIMARY KEY,
  github_issue_number INTEGER NOT NULL UNIQUE,
  region_slug TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published', 'withdrawn')),
  title TEXT NOT NULL,
  summary TEXT,
  nickname TEXT,
  markdown TEXT,
  external_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE tags (id INTEGER PRIMARY KEY, normalized TEXT NOT NULL UNIQUE, label TEXT NOT NULL);
CREATE TABLE content_tags (
  content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, tag_id)
);
CREATE TABLE webhook_deliveries (
  delivery_id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL
);
CREATE TABLE submission_fingerprints (
  fingerprint TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL,
  reservation_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('reserved', 'submitted')),
  expires_at TEXT NOT NULL
);
CREATE TABLE successful_submission_events (
  source_hash TEXT NOT NULL,
  succeeded_at TEXT NOT NULL
);
CREATE TABLE reconciliation_cursors (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX contents_region_published_idx ON contents(region_slug, published_at DESC);
CREATE INDEX contents_status_updated_idx ON contents(status, updated_at DESC);
CREATE INDEX successful_submission_events_window_idx
  ON successful_submission_events(source_hash, succeeded_at DESC);
