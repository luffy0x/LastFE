export const moderationAuthorityBackfillMigrationSql = `UPDATE moderation_issue_states
SET authoritative = 1
WHERE review_event_created_at IS NOT NULL
  AND review_event_id IS NOT NULL;
`;
