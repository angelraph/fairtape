// US equity sessions in New York time. Tokenized-stock oracles (Chainlink "us_equities_24/5")
// and Robinhood's market data run Sunday 20:00 ET → Friday 20:00 ET.
export type Session = "regular" | "pre" | "post" | "overnight" | "closed";

export function nySession(now = new Date()): { session: Session; label: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday");
  const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));

  const weekendClosed =
    day === "Sat" || (day === "Fri" && minutes >= 20 * 60) || (day === "Sun" && minutes < 20 * 60);
  if (weekendClosed) return { session: "closed", label: "Weekend: oracles paused, onchain venues still trade" };
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return { session: "regular", label: "US market open" };
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return { session: "pre", label: "Pre-market" };
  if (minutes >= 16 * 60 && minutes < 20 * 60) return { session: "post", label: "After-hours" };
  return { session: "overnight", label: "Overnight session" };
}
