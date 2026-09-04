import { describe, expect, it } from "vitest";
import { createChallenge } from "altcha-lib/v1";

import { createAltchaChallengeService } from "./challenge";

describe("ALTCHA challenge service", () => {
  it("creates a signed expiring v1 challenge for the self-hosted widget", async () => {
    const service = createAltchaChallengeService("test-altcha-secret");

    const challenge = await service.create();

    expect(challenge).toMatchObject({
      algorithm: "SHA-256",
      challenge: expect.stringMatching(/^[a-f0-9]{64}$/),
      salt: expect.stringContaining("expires="),
      signature: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("accepts object and base64 payloads signed with the configured key", async () => {
    const key = "test-altcha-secret";
    const service = createAltchaChallengeService(key);
    const challenge = await createChallenge({
      algorithm: "SHA-256",
      hmacKey: key,
      number: 1,
      expires: new Date(Date.now() + 60_000),
    });
    const payload = { ...challenge, number: 1 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");

    await expect(service.verify(payload)).resolves.toBe(true);
    await expect(service.verify(encoded)).resolves.toBe(true);
  });

  it("fails closed for malformed or incorrectly signed payloads", async () => {
    const service = createAltchaChallengeService("test-altcha-secret");

    await expect(service.verify({ not: "a payload" })).resolves.toBe(false);
    await expect(service.verify("not-base64-payload")).resolves.toBe(false);
  });

  it("rejects an empty secret", () => {
    expect(() => createAltchaChallengeService("")).toThrow();
  });
});
