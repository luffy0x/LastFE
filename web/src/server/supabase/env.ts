export function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function requireSupabaseUrl(): string {
  const value = requireServerEnv("SUPABASE_URL");

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("must use HTTPS");
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTPS URL");
  }

  return value;
}
