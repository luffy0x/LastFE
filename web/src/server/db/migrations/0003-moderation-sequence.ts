export const moderationSequenceMigrationSql = `ALTER TABLE moderation_issue_states ADD COLUMN review_event_created_at TEXT;
ALTER TABLE moderation_issue_states ADD COLUMN review_event_id TEXT;
ALTER TABLE moderation_issue_states ADD COLUMN authoritative INTEGER NOT NULL DEFAULT 0 CHECK (authoritative IN (0, 1));
`;
