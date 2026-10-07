"use client";

import type { Tape } from "@/lib/server/tape";
import type { Asset } from "@/lib/registry";
import { CHAIN_LABEL, EXPLORER } from "@/lib/registry";
import { useTape } from "./use-tape";
import { usd, bpsLabel, bpsClass, compactUsd, ago } from "@/lib/format";
import { ISSUER_COLOR } from "./premium-chart";

export function VenueCards({ initial, asset }: { initial: Tape; asset: Asset }) {
  const { data: tape } = useTape(initial);
  const row = tape?.rows.find((r) => r.ticker === asset.ticker);
  if (!row) return null;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {row.venues.map((v) => {
        const meta = asset.venues.find((x) => x.address === v.address)!;
        const key = `${v.chain}:${v.address}`;
        return (
          <div key={key} className={`panel p-4 ${row.bestBuy === key ? "!border-pos/40" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: ISSUER_COLOR[v.issuer] }} />
                {v.symbol}
              </span>
              <span className="chip">
                <span className={`chain-dot chain-${v.chain}`} />
                {CHAIN_LABEL[v.chain]}
              </span>
            </div>
            <div className="small muted mt-0.5">{v.issuer}</div>
            <div className="num text-2xl mt-3">{usd(v.pricePerShare)}</div>
            <div className={`num small ${bpsClass(v.premiumBps)}`}>{bpsLabel(v.premiumBps)} vs reference</div>
            <dl className="mt-4 grid grid-cols-2 gap-y-1.5 small">
              <dt className="muted">Token price</dt>
              <dd className="num text-right">{usd(v.priceToken)}</dd>
              <dt className="muted">Shares / token</dt>
              <dd className="num text-right">{v.multiplier?.toFixed(6) ?? "n/a"}</dd>
              <dt className="muted">Liquidity</dt>
              <dd className="num text-right">{compactUsd(v.liquidityUsd)}</dd>
              {v.oracle && (
                <>
                  <dt className="muted">Chainlink</dt>
                  <dd className="num text-right">{usd(v.oracle.pricePerShare)}</dd>
                  <dt className="muted">Oracle update</dt>
                  <dd className="text-right">{ago(v.oracle.ageSec)}</dd>
                </>
              )}
            </dl>
            {v.pendingMultiplier && (
              <p className="small warn mt-3" suppressHydrationWarning>
                Multiplier changes to {v.pendingMultiplier.value.toFixed(6)} on {new Date(v.pendingMultiplier.effectiveAt * 1000).toLocaleDateString()}
              </p>
            )}
            {v.warnings.length > 0 && <p className="small warn mt-3">{v.warnings.join(" · ")}</p>}
            <div className="mt-4 pt-3 border-t border-line small flex flex-wrap gap-x-3 gap-y-1">
              <a className="muted hover:text-text underline" href={EXPLORER[v.chain].token(v.address)} target="_blank" rel="noreferrer">Token ↗</a>
              {meta.pool && (
                <a className="muted hover:text-text underline" href={EXPLORER[v.chain].address(meta.pool.address)} target="_blank" rel="noreferrer">Pool ↗</a>
              )}
              {meta.chainlinkFeed && (
                <a className="muted hover:text-text underline" href={EXPLORER[v.chain].address(meta.chainlinkFeed)} target="_blank" rel="noreferrer">Feed ↗</a>
              )}
            </div>
            <div className="small faint mt-2 truncate" title={v.priceSource}>Price: {v.priceSource}</div>
          </div>
        );
      })}
    </div>
  );
}
