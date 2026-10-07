"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HistoryPoint } from "@/lib/server/snapshots";

// Validated (dark surface #111312): lightness band, chroma, CVD ΔE ≥ 9.4, contrast ≥ 3:1.
export const ISSUER_COLOR: Record<string, string> = {
  xStocks: "#8f63f0",
  Ondo: "#e0607f",
  Robinhood: "#7f9f00",
  Coinbase: "#3b7bff",
};
const ORDER = ["xStocks", "Ondo", "Robinhood", "Coinbase"];

const W = 860;
const H = 260;
const PAD = { l: 52, r: 86, t: 14, b: 28 };

export function PremiumChart({ ticker }: { ticker: string }) {
  const [hours, setHours] = useState(24);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { data, isLoading } = useQuery<{ points: HistoryPoint[] }>({
    queryKey: ["history", ticker, hours],
    queryFn: () => fetch(`/api/history/${ticker}?hours=${hours}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const model = useMemo(() => {
    const pts = (data?.points ?? []).filter((p) => p.premium_bps != null);
    if (pts.length < 2) return null;
    const series = ORDER.map((issuer) => ({
      issuer,
      pts: pts.filter((p) => p.issuer === issuer).map((p) => ({ t: Date.parse(p.ts), v: p.premium_bps! })),
    })).filter((s) => s.pts.length > 1);
    const ts = pts.map((p) => Date.parse(p.ts));
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    const vals = series.flatMap((s) => s.pts.map((p) => p.v));
    // Clamp extreme outliers (thin venues) so liquid venues stay readable.
    const sorted = [...vals].sort((a, b) => a - b);
    const lo = Math.min(-10, sorted[Math.floor(sorted.length * 0.02)] ?? 0);
    const hi = Math.max(10, sorted[Math.ceil(sorted.length * 0.98) - 1] ?? 0);
    const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const ticksY = niceTicks(lo, hi, 5);
    return { series, t0, t1, x, y, ticksY, lo, hi };
  }, [data]);

  const hover = useMemo(() => {
    if (!model || hoverX == null) return null;
    const t = model.t0 + ((hoverX - PAD.l) / (W - PAD.l - PAD.r)) * (model.t1 - model.t0);
    const rows = model.series.map((s) => {
      const nearest = s.pts.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
      return { issuer: s.issuer, ...nearest };
    });
    return { t: rows[0]?.t ?? t, rows };
  }, [model, hoverX]);

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="font-medium">Premium vs reference, per share</div>
          <div className="small muted">Basis points above (+) or below (−) the underlying share price. Recorded every minute.</div>
        </div>
        <div className="flex gap-1 p-1 rounded-lg border border-line bg-bg">
          {[6, 24, 72, 168].map((h) => (
            <button key={h} onClick={() => setHours(h)} className={`px-2.5 h-7 rounded-md text-xs ${hours === h ? "bg-panel-2 text-text" : "text-muted"}`}>
              {h < 24 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 mb-2 small">
        {ORDER.map((i) => (
          <span key={i} className="inline-flex items-center gap-1.5 muted">
            <span className="inline-block w-3 h-[3px] rounded" style={{ background: ISSUER_COLOR[i] }} />
            {i}
          </span>
        ))}
      </div>
      {isLoading && <div className="skeleton h-[260px]" />}
      {!isLoading && !model && <div className="h-[200px] grid place-items-center small muted">History is still building. Check back in a few minutes.</div>}
      {model && (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label={`${ticker} premium by issuer`}
            onPointerMove={(e) => {
              const r = svgRef.current!.getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              setHoverX(px >= PAD.l && px <= W - PAD.r ? px : null);
            }}
            onPointerLeave={() => setHoverX(null)}
          >
            {model.ticksY.map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={model.y(v)} y2={model.y(v)} stroke={v === 0 ? "#3a403b" : "#1d211e"} strokeWidth={1} />
                <text x={PAD.l - 8} y={model.y(v) + 4} textAnchor="end" fontSize="11" fill="#5d655f" className="num">
                  {v > 0 ? `+${v}` : v}
                </text>
              </g>
            ))}
            {[0, 0.5, 1].map((f) => {
              const t = model.t0 + f * (model.t1 - model.t0);
              return (
                <text key={f} x={model.x(t)} y={H - 8} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} fontSize="11" fill="#5d655f">
                  {new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </text>
              );
            })}
            {model.series.map((s) => {
              const d = s.pts.map((p, i) => `${i ? "L" : "M"}${model.x(p.t).toFixed(1)},${model.y(p.v).toFixed(1)}`).join("");
              const last = s.pts.at(-1)!;
              return (
                <g key={s.issuer}>
                  <path d={d} fill="none" stroke={ISSUER_COLOR[s.issuer]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  <text x={model.x(last.t) + 8} y={model.y(last.v) + 4} fontSize="11" fill="#8b938d">
                    {s.issuer}
                  </text>
                </g>
              );
            })}
            {hover && (
              <g>
                <line x1={model.x(hover.t)} x2={model.x(hover.t)} y1={PAD.t} y2={H - PAD.b} stroke="#5d655f" strokeWidth={1} />
                {hover.rows.map((r) => (
                  <circle key={r.issuer} cx={model.x(r.t)} cy={model.y(r.v)} r={4} fill={ISSUER_COLOR[r.issuer]} stroke="#111312" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
          {hover && (
            <div
              className="absolute top-2 panel !bg-bg px-3 py-2 small pointer-events-none"
              style={{ left: `${(model.x(hover.t) / W) * 100}%`, transform: model.x(hover.t) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
            >
              <div className="muted mb-1">{new Date(hover.t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              {hover.rows.map((r) => (
                <div key={r.issuer} className="flex items-center gap-2 justify-between min-w-[150px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: ISSUER_COLOR[r.issuer] }} />
                    {r.issuer}
                  </span>
                  <span className="num">{r.v > 0 ? "+" : ""}{r.v.toFixed(1)} bp</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function niceTicks(lo: number, hi: number, n: number) {
  const span = hi - lo;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v));
  return out;
}
