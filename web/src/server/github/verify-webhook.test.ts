import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyGitHubSignature } from "./verify-webhook";

const BODY = new TextEncoder().encode('{"action":"labeled"}');
const sign = (body: Uint8Array, secret: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("verifyGitHubSignature", () => {
  it("accepts the HMAC for the exact raw request bytes", () => {
    expect(verifyGitHubSignature(BODY, sign(BODY, "correct"), "correct")).toBe(
      true,
    );
    expect(
      verifyGitHubSignature(
        new TextEncoder().encode('{"action": "labeled"}'),
        sign(BODY, "correct"),
        "correct",
      ),
    ).toBe(false);
  });

  it("rejects a body signed with the wrong secret", () => {
    expect(verifyGitHubSignature(BODY, sign(BODY, "wrong"), "correct")).toBe(
      false,
    );
  });

  it.each([null, "", "sha1=abc", "sha256=xyz", `sha256=${"a".repeat(63)}`])(
    "rejects a missing or malformed signature: %s",
    (signature) => {
      expect(verifyGitHubSignature(BODY, signature, "correct")).toBe(false);
    },
  );
});
