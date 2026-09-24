/**
 * Applies supabase/migrations/*.sql in order against DATABASE_URL.
 *
 * DATABASE_URL is the direct Postgres connection string from
 * Supabase Dashboard -> Project Settings -> Database -> Connection string
 * (URI, "Session" mode). It is separate from the Supabase API keys and is
 * only needed locally to run migrations/seeds — the running application
 * never uses it.
 *
 * Equivalent alternative: paste the files in supabase/migrations/ into the
 * Supabase SQL editor in order, or use the Supabase CLI
 * (`supabase link` + `supabase db push`) if you prefer that workflow.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "./load-env";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Add it to .env.local (Supabase Dashboard -> " +
        "Project Settings -> Database -> Connection string -> URI), or run " +
        "the files in supabase/migrations/ manually via the Supabase SQL editor.",
    );
    process.exit(1);
  }

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(
      `create table if not exists _migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    );

    for (const file of files) {
      const { rows } = await client.query(
        "select 1 from _migrations where name = $1",
        [file],
      );
      if (rows.length > 0) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [
          file,
        ]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
