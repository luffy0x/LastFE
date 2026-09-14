import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MAX_WEBHOOK_BYTES = 128 * 1024;
const DIAGNOSTIC_DIGEST_LENGTH = 12;
const SIGNATURE_PREFIX_LENGTH = "sha256=".length + DIAGNOSTIC_DIGEST_LENGTH;

function createGitHubWebhookSignature(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function describeGitHubWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
) {
  const expectedSignature = createGitHubWebhookSignature(body, secret);

  return {
    webhookKeyBytes: Buffer.byteLength(secret, "utf8"),
    webhookKeyFingerprint: createHash("sha256")
      .update(secret)
      .digest("hex")
      .slice(0, DIAGNOSTIC_DIGEST_LENGTH),
    payloadBytes: Buffer.byteLength(body, "utf8"),
    payloadSha256: createHash("sha256").update(body).digest("hex"),
    providedSignaturePrefix: signature?.slice(0, SIGNATURE_PREFIX_LENGTH) ?? null,
    expectedSignaturePrefix: expectedSignature.slice(0, SIGNATURE_PREFIX_LENGTH),
  };
}

export function verifyGitHubWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature?.startsWith("sha256=") || !secret) return false;

  const expected = createGitHubWebhookSignature(body, secret);
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
