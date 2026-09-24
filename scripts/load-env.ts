/**
 * Standalone scripts run via tsx, not through Next.js, so Next's automatic
 * .env.local loading doesn't apply here — plain `dotenv/config` only reads
 * `.env` by default. Load `.env.local` first (Next.js's own precedence:
 * .env.local overrides .env), falling back to `.env`.
 */
import { config } from "dotenv";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  config({ path: ".env.local" });
} else {
  config();
}
