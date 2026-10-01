export function usd(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function compactUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return "$" + Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function bpsLabel(b: number | null | undefined) {
  if (b == null || !Number.isFinite(b)) return "—";
  const sign = b > 0 ? "+" : "";
  return `${sign}${b.toFixed(1)} bp`;
}

export function bpsClass(b: number | null | undefined) {
  if (b == null) return "faint";
  if (Math.abs(b) < 3) return "muted";
  return b > 0 ? "neg" : "pos"; // cheaper than reference is good for a buyer
}

export function amount(n: number | null | undefined, digits = 4) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function ago(sec: number | null | undefined) {
  if (sec == null) return "—";
  if (sec < 90) return `${Math.round(sec)}s ago`;
  if (sec < 5400) return `${Math.round(sec / 60)}m ago`;
  if (sec < 172800) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}
