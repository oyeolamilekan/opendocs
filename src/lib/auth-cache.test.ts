// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureProfileCached, resetAuthCache } from "./auth-cache";

describe("auth cache", () => {
  beforeEach(() => {
    resetAuthCache();
  });

  it("deduplicates profile bootstrap and reuses readiness", async () => {
    const ensureProfile = vi.fn().mockResolvedValue(undefined);

    await Promise.all([
      ensureProfileCached(ensureProfile),
      ensureProfileCached(ensureProfile),
    ]);
    await ensureProfileCached(ensureProfile);

    expect(ensureProfile).toHaveBeenCalledTimes(1);
  });

  it("runs profile bootstrap again after an auth boundary reset", async () => {
    const ensureProfile = vi.fn().mockResolvedValue(undefined);

    await ensureProfileCached(ensureProfile);
    resetAuthCache();
    await ensureProfileCached(ensureProfile);

    expect(ensureProfile).toHaveBeenCalledTimes(2);
  });

  it("retries after a failed bootstrap", async () => {
    const ensureProfile = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(undefined);

    await expect(ensureProfileCached(ensureProfile)).rejects.toThrow(
      "temporary",
    );
    await ensureProfileCached(ensureProfile);

    expect(ensureProfile).toHaveBeenCalledTimes(2);
  });
});
