import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_WEBHOOK_BYTES = 128 * 1024;

export function verifyGitHubWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature?.startsWith("sha256=") || !secret) return false;

  const expected = `sha256=${createHmac("sha256", secret)
    .update(body)
    .digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function readBoundedBody(request: Request): Promise<string> {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_WEBHOOK_BYTES) {
    throw new Error("Webhook body is too large");
  }
  return body;
}
