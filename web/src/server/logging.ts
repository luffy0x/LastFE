export type LogLevel = "info" | "warn" | "error";
export type StructuredLogger = (
  level: LogLevel,
  event: string,
  fields: Record<string, unknown>,
) => void;

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|body|markdown|ip/i;
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(nestedValue),
    ]),
  );
}

export function requestIdFromHeaders(headers: Headers): string {
  const requestId = headers.get("x-request-id");
  return requestId && VALID_REQUEST_ID.test(requestId)
    ? requestId
    : crypto.randomUUID();
}

export const log: StructuredLogger = (level, event, fields) => {
  const redactedFields = redact(fields) as Record<string, unknown>;
  console[level](JSON.stringify({ ...redactedFields, level, event }));
};
