import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("log", () => {
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.LOG_LEVEL = originalLogLevel;
    vi.restoreAllMocks();
  });

  it("suppresses debug/info calls below the configured LOG_LEVEL", async () => {
    process.env.LOG_LEVEL = "warn";
    const { log } = await import("./logger");

    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    log.debug("should be suppressed");
    log.info("should be suppressed");
    log.warn("should print");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("should print");
  });

  it("always prints error calls regardless of LOG_LEVEL", async () => {
    process.env.LOG_LEVEL = "error";
    const { log } = await import("./logger");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    log.error("boom", { runId: "abc" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("boom");
    expect(errorSpy.mock.calls[0][1]).toEqual({ runId: "abc" });
  });
});
