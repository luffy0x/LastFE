export const moderationSequenceMigrationSql = `ALTER TABLE moderation_issue_states ADD COLUMN review_event_created_at TEXT;
ALTER TABLE moderation_issue_states ADD COLUMN review_event_id TEXT;
`;
