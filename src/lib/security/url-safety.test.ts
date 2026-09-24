import { describe, expect, it } from "vitest";

import { AppError } from "@/domain/shared/errors";
import { assertUrlIsSafeToFetch } from "./url-safety";

describe("assertUrlIsSafeToFetch", () => {
  it("rejects an unsupported scheme", async () => {
    await expect(assertUrlIsSafeToFetch("ftp://example.com")).rejects.toThrow(
      AppError,
    );
  });

  it("rejects localhost by name", async () => {
    await expect(
      assertUrlIsSafeToFetch("http://localhost/"),
    ).rejects.toMatchObject({
      code: "SSRF_BLOCKED",
    });
  });

  // TEST-PLAN.md SSRF tests: reject literal loopback/private/link-local IPs,
  // including the cloud metadata endpoint.
  it.each([
    ["http://127.0.0.1/"],
    ["http://10.0.0.1/"],
    ["http://192.168.1.1/"],
    ["http://172.16.0.5/"],
    ["http://169.254.169.254/"], // cloud metadata endpoint
    ["http://0.0.0.0/"],
  ])("rejects the private/internal address %s", async (url) => {
    await expect(assertUrlIsSafeToFetch(url)).rejects.toMatchObject({
      code: "SSRF_BLOCKED",
    });
  });

  it("rejects IPv6 loopback", async () => {
    await expect(assertUrlIsSafeToFetch("http://[::1]/")).rejects.toMatchObject(
      {
        code: "SSRF_BLOCKED",
      },
    );
  });
});
