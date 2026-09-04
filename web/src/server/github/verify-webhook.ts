import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PATTERN = /^sha256=[0-9a-f]{64}$/;

export function verifyGitHubSignature(
  rawBody: Uint8Array,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !SIGNATURE_PATTERN.test(signature)) return false;

  const expected = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  const expectedBytes = Buffer.from(expected, "ascii");
  const receivedBytes = Buffer.from(signature, "ascii");

  return (
    expectedBytes.byteLength === receivedBytes.byteLength &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}
