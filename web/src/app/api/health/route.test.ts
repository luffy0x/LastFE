import { describe, expect, it, vi } from "vitest";

import { createHealthHandler } from "./route";

describe("health route", () => {
  it("reports healthy without exposing paths or secrets", async () => {
    const handler = createHealthHandler({
      probeDatabase: vi.fn().mockResolvedValue(undefined),
      probeDataDirectory: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    });

    const response = await handler();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("reports an unhealthy category without exposing probe details", async () => {
    const log = vi.fn();
    const handler = createHealthHandler({
      probeDatabase: vi.fn().mockRejectedValue(new Error("/srv/private/app.db")),
      probeDataDirectory: vi.fn().mockResolvedValue(undefined),
      log,
    });

    const response = await handler();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toBe('{"status":"unhealthy"}');
    expect(body).not.toContain("/srv/private/app.db");
    expect(log).toHaveBeenCalledWith(
      "error",
      "health.check_failed",
      expect.objectContaining({ errorCategory: "database", requestId: expect.any(String) }),
    );
  });
});
