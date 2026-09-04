import {
  createChallenge,
  verifySolution,
} from "altcha-lib/v1";
import type {
  Challenge as AltchaChallenge,
  Payload as AltchaPayload,
} from "altcha-lib/v1/types";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_NUMBER = 1_000_000;

export type ChallengeService = {
  create(): Promise<AltchaChallenge>;
  verify(payload: unknown): Promise<boolean>;
};

export function createAltchaChallengeService(
  hmacKey: string,
  maxNumber = DEFAULT_MAX_NUMBER,
): ChallengeService {
  if (!hmacKey) throw new Error("ALTCHA_HMAC_KEY is required");
  if (!Number.isSafeInteger(maxNumber) || maxNumber < 1) {
    throw new Error("ALTCHA_MAX_NUMBER must be a positive integer");
  }

  return {
    create() {
      return createChallenge({
        algorithm: "SHA-256",
        hmacKey,
        maxNumber,
        expires: new Date(Date.now() + CHALLENGE_TTL_MS),
      });
    },
    async verify(payload) {
      if (typeof payload !== "string" && (!payload || typeof payload !== "object")) {
        return false;
      }

      try {
        return await verifySolution(payload as string | AltchaPayload, hmacKey);
      } catch {
        return false;
      }
    },
  };
}
