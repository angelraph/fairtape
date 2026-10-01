import "server-only";
import { getDb } from "./db";
import type { Tape } from "./tape";

let lastRecorded = 0;
const MIN_INTERVAL_MS = 60_000;

// Persists one row per venue. Called whenever a fresh tape is computed, at most once a minute,
// plus by the cron route so history keeps growing when nobody is looking.
export async function recordSnapshot(tape: Tape, force = false) {
  if (!force && Date.now() - lastRecorded < MIN_INTERVAL_MS) return 0;
  lastRecorded = Date.now();
  const db = await getDb();
  const ts = new Date(tape.asOf * 1000).toISOString();
  const values: unknown[] = [];
  const tuples: string[] = [];
  for (const row of tape.rows) {
    for (const v of row.venues) {
      if (v.pricePerShare == null) continue;
      const o = values.length;
      tuples.push(`($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8})`);
      values.push(ts, row.ticker, v.issuer, v.chain, v.pricePerShare, row.reference.price, v.premiumBps, v.liquidityUsd);
    }
  }
  if (!tuples.length) return 0;
  await db.query(
    `insert into tape_snapshots (ts, ticker, issuer, chain, price_per_share, reference, premium_bps, liquidity_usd) values ${tuples.join(",")}`,
    values,
  );
  return tuples.length;
}

export type HistoryPoint = { ts: string; issuer: string; chain: string; premium_bps: number | null; price_per_share: number };

export async function getHistory(ticker: string, hours = 72): Promise<HistoryPoint[]> {
  const db = await getDb();
  const { rows } = await db.query<HistoryPoint>(
    `select ts, issuer, chain, premium_bps, price_per_share from tape_snapshots
     where ticker = $1 and ts > now() - ($2 || ' hours')::interval order by ts asc`,
    [ticker, String(hours)],
  );
  return rows.map((r) => ({ ...r, ts: new Date(r.ts).toISOString() }));
}
