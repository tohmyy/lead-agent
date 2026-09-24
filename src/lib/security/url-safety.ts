import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { AppError } from "@/domain/shared/errors";
import { parseUrlStrict } from "@/domain/shared/normalize";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

interface Ipv4Range {
  base: number[];
  bits: number;
}

function ipv4ToInt(parts: number[]): number {
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  );
}

const PRIVATE_IPV4_RANGES: Ipv4Range[] = [
  { base: [0, 0, 0, 0], bits: 8 }, // "this" network
  { base: [10, 0, 0, 0], bits: 8 }, // private
  { base: [100, 64, 0, 0], bits: 10 }, // carrier-grade NAT
  { base: [127, 0, 0, 0], bits: 8 }, // loopback
  { base: [169, 254, 0, 0], bits: 16 }, // link-local incl. cloud metadata (169.254.169.254)
  { base: [172, 16, 0, 0], bits: 12 }, // private
  { base: [192, 0, 0, 0], bits: 24 }, // IETF protocol assignments
  { base: [192, 0, 2, 0], bits: 24 }, // TEST-NET-1
  { base: [192, 168, 0, 0], bits: 16 }, // private
  { base: [198, 18, 0, 0], bits: 15 }, // benchmarking
  { base: [224, 0, 0, 0], bits: 4 }, // multicast
  { base: [240, 0, 0, 0], bits: 4 }, // reserved
];

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const asInt = ipv4ToInt(parts);
  return PRIVATE_IPV4_RANGES.some((range) => {
    const mask = range.bits === 0 ? 0 : (0xffffffff << (32 - range.bits)) >>> 0;
    return (asInt & mask) === (ipv4ToInt(range.base) & mask);
  });
}

function isPrivateIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower === "::") return true; // unspecified
  if (
    lower.startsWith("fe80:") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  ) {
    return true; // link-local fe80::/10
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 address — check the embedded IPv4 address too.
    const embedded = lower.slice("::ffff:".length);
    if (isIP(embedded) === 4) return isPrivateIpv4(embedded);
  }
  return false;
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true; // unrecognized shape — fail closed
}

/**
 * Validates a URL is safe to fetch (TOOL-CONTRACTS.md sections 20-21,
 * AGENTS.md section 21): http/https only, not a blocked hostname, and does
 * not resolve (including via DNS rebinding) to a loopback/private/
 * link-local/cloud-metadata address.
 *
 * Throws AppError("SSRF_BLOCKED" | "INVALID_URL", ...) on failure.
 */
export async function assertUrlIsSafeToFetch(input: string): Promise<URL> {
  const url = parseUrlStrict(input);
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new AppError(
      "SSRF_BLOCKED",
      "This URL points to a blocked internal hostname.",
    );
  }

  // A literal IP in the URL itself.
  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw new AppError(
      "SSRF_BLOCKED",
      "This URL resolves to a private or internal network address.",
    );
  }

  let resolved: { address: string }[];
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError(
      "INVALID_URL",
      "The URL's hostname could not be resolved.",
    );
  }

  if (resolved.length === 0 || resolved.some((r) => isPrivateIp(r.address))) {
    throw new AppError(
      "SSRF_BLOCKED",
      "This URL resolves to a private or internal network address.",
    );
  }

  return url;
}
