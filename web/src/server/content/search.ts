export function escapeSearchTerm(value: string): string {
  return value.trim().replace(/\\/g, "\\\\").replace(/[%_,()]/g, "\\$&");
}

export function buildContentSearchFilter(search: string): string | null {
  const term = escapeSearchTerm(search);
  if (!term) return null;

  const pattern = `*${term}*`;
  return [
    `title.ilike.${pattern}`,
    `summary.ilike.${pattern}`,
    `markdown.ilike.${pattern}`,
    `metadata_json::text.ilike.${pattern}`,
  ].join(",");
}
