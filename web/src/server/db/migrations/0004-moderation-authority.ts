export const moderationAuthorityMigrationSql = `ALTER TABLE moderation_issue_states ADD COLUMN authoritative INTEGER NOT NULL DEFAULT 0 CHECK (authoritative IN (0, 1));
`;
