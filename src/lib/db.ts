// One tiny query interface over two drivers:
//  - DATABASE_URL set  → a real PostgreSQL server through `pg` (production, Neon…)
//  - DATABASE_URL empty → PGlite, an embedded PostgreSQL kept in .data/pglite,
//    so local development needs nothing installed.
// Both are real Postgres, so the SQL is identical. Aggregates are cast to
// ::int because `pg` returns bigint as a string.
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { MIGRATIONS } from "./schema";

export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs one or more statements without parameters. */
  exec(sql: string): Promise<void>;
}

export interface Db extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

declare global {
  // Survives dev hot reloads so we never open the embedded database twice.
  var __arnoobaDb: Promise<Db> | undefined;
  // How many migrations that connection has applied; a hot reload that adds
  // one runs it on the next query instead of failing until a restart.
  var __arnoobaMigrated: Promise<number> | undefined;
}

async function connectPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX) || 5 });
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));

  return {
    async query<T>(text: string, params?: unknown[]) {
      return (await pool.query(text, params)).rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction<T>(fn: (tx: Sql) => Promise<T>) {
      const client = await pool.connect();
      const tx: Sql = {
        async query<R>(text: string, params?: unknown[]) {
          return (await client.query(text, params)).rows as R[];
        },
        async exec(sql: string) {
          await client.query(sql);
        },
      };
      try {
        await client.query("BEGIN");
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

async function connectEmbedded(): Promise<Db> {
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is required on Vercel. Create a Postgres database (e.g. Neon) and set it.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  // Local-only path: keep the bundler from tracing the whole project for it.
  const dataDir = path.resolve(/*turbopackIgnore: true*/ process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite"));
  await mkdir(dataDir, { recursive: true });
  const pg = await PGlite.create({ dataDir });

  type Handle = {
    query<R>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
    exec(sql: string): Promise<unknown>;
  };
  const wrap = (handle: Handle): Sql => ({
    async query<T>(text: string, params?: unknown[]) {
      return (await handle.query<T>(text, params)).rows;
    },
    async exec(sql: string) {
      await handle.exec(sql);
    },
  });

  return {
    ...wrap(pg),
    transaction: <T>(fn: (tx: Sql) => Promise<T>) => pg.transaction((tx) => fn(wrap(tx))),
  };
}

async function migrate(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    // Serverless instances may cold-start together; only one migrates.
    await tx.query("SELECT pg_advisory_xact_lock(724117)");
    await tx.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = await tx.query<{ version: number }>("SELECT version FROM schema_migrations");
    const done = new Set(applied.map((row) => row.version));
    for (const [index, statement] of MIGRATIONS.entries()) {
      const version = index + 1;
      if (done.has(version)) continue;
      await tx.exec(statement);
      await tx.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    }
  });
}

function connect(): Promise<Db> {
  if (!globalThis.__arnoobaDb) {
    const url = process.env.DATABASE_URL?.trim();
    const pending = url ? connectPostgres(url) : connectEmbedded();
    pending.catch(() => {
      if (globalThis.__arnoobaDb === pending) globalThis.__arnoobaDb = undefined;
    });
    globalThis.__arnoobaDb = pending;
    globalThis.__arnoobaMigrated = undefined;
  }
  return globalThis.__arnoobaDb;
}

export async function getDb(): Promise<Db> {
  const db = await connect();
  const migrated = globalThis.__arnoobaMigrated;
  if (!migrated || (await migrated.catch(() => -1)) < MIGRATIONS.length) {
    if (globalThis.__arnoobaMigrated === migrated) {
      const run = migrate(db).then(() => MIGRATIONS.length);
      run.catch(() => {
        if (globalThis.__arnoobaMigrated === run) globalThis.__arnoobaMigrated = undefined;
      });
      globalThis.__arnoobaMigrated = run;
    }
    await globalThis.__arnoobaMigrated;
  }
  return db;
}

export async function sql<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  return (await getDb()).query<T>(text, params);
}
