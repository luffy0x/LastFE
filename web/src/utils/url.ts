export function isSafeHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return false;

  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol) && url.href === trimmed;
  } catch {
    return false;
  }
}
