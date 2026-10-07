import { ROADMAP } from "@/lib/content";
import { Reveal } from "../motion";

const STATUS = {
  shipped: { label: "Shipped", cls: "!border-pos/40 pos", dot: "bg-pos" },
  next: { label: "Next", cls: "!border-warn/40 warn", dot: "bg-warn" },
  planned: { label: "Planned", cls: "", dot: "bg-line-2" },
} as const;

export function Roadmap({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={`relative grid gap-5 ${compact ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
      <div className={`hidden ${compact ? "" : "md:block"} absolute left-0 right-0 top-[19px] h-px bg-gradient-to-r from-pos/60 via-line to-line`} aria-hidden />
      {ROADMAP.map((p, i) => {
        const s = STATUS[p.status];
        return (
          <Reveal as="li" key={p.when} delay={i * 120} className="relative">
            <div className="flex items-center gap-3 mb-4">
              <span className={`relative z-10 w-[11px] h-[11px] rounded-full ${s.dot} ring-4 ring-bg ${p.status === "shipped" ? "pulse-dot text-pos" : ""}`} />
              <span className={`chip ${s.cls}`}>{s.label}</span>
            </div>
            <div className={`tint ${p.status === "shipped" ? "tint-green" : "tint-violet"} p-5 h-full`}>
              <div className="small faint">{p.when}</div>
              <div className="font-semibold mt-1">{p.title}</div>
              <ul className="mt-3 grid gap-2">
                {p.items.map((it) => (
                  <li key={it} className="small muted flex gap-2">
                    <span className={p.status === "shipped" ? "pos" : "faint"}>{p.status === "shipped" ? "✓" : "○"}</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        );
      })}
    </ol>
  );
}
