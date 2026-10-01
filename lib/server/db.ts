import "server-only";

// One tiny query interface over two backends:
//  - Postgres (Neon/Supabase/any) when DATABASE_URL is set — used in production.
//  - PGlite (embedded Postgres, persisted to .data/) for local development, zero setup.
type Row = Record<string, unknown>;
type Db = { query<T extends Row = Row>(text: string, params?: unknown[]): Promise<{ rows: T[] }> };

const SCHEMA = `
create table if not exists tape_snapshots (
  id bigserial primary key,
  ts timestamptz not null,
  ticker text not null,
  issuer text not null,
  chain text not null,
  price_per_share double precision,
  reference double precision,
  premium_bps double precision,
  liquidity_usd double precision
);
create index if not exists tape_snapshots_ticker_ts on tape_snapshots (ticker, ts);

create table if not exists invoices (
  id text primary key,
  created_at timestamptz not null default now(),
  merchant_name text not null,
  memo text,
  amount_usd numeric not null,
  settle_chain text not null,
  recipient text not null,
  status text not null default 'open',
  paid_at timestamptz,
  payer_chain text,
  payer_asset text,
  source_tx text,
  settle_tx text,
  settled_amount numeric
);
`;

declare global {
  var __fairtapeDb: Promise<Db> | undefined;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 3, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } });
    db = { query: (text, params) => pool.query(text, params as unknown[]) as never };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    const dir = `${process.cwd()}/.data/pglite`;
    mkdirSync(dir, { recursive: true });
    const pg = new PGlite(dir);
    db = { query: (text, params) => pg.query(text, params) as never };
  }
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
  return db;
}

export function getDb(): Promise<Db> {
  globalThis.__fairtapeDb ??= connect().catch((e) => {
    globalThis.__fairtapeDb = undefined;
    throw e;
  });
  return globalThis.__fairtapeDb;
}
