import { short } from "./connect";

/** Shown right above every Pay button, so the payer always sees exactly who the money goes to. */
export function PayingTo({ name, recipient, chainLabel, href }: { name: string; recipient: string; chainLabel: string; href: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg px-4 py-3 small">
      <span className="muted">You&apos;re paying </span>
      <span className="font-medium">{name}</span>
      <span className="muted"> at </span>
      <a className="num underline hover:text-text" href={href} target="_blank" rel="noreferrer">
        {short(recipient, 6)} ↗
      </a>
      <span className="muted"> on {chainLabel}. The money goes straight to this address.</span>
    </div>
  );
}
