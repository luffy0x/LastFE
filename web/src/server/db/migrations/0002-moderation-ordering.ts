export const moderationOrderingMigrationSql = `CREATE TABLE moderation_issue_states_v2 (
  github_issue_number INTEGER PRIMARY KEY,
  decision TEXT NOT NULL CHECK (decision IN ('published', 'withdrawn', 'rejected', 'ignored')),
  updated_at TEXT NOT NULL,
  snapshot_identity TEXT NOT NULL
);
INSERT INTO moderation_issue_states_v2 (
  github_issue_number,
  decision,
  updated_at,
  snapshot_identity
)
SELECT
  github_issue_number,
  status,
  updated_at,
  'legacy:' || status || ':' || updated_at
FROM moderation_issue_states;
DROP TABLE moderation_issue_states;
ALTER TABLE moderation_issue_states_v2 RENAME TO moderation_issue_states;
`;
