import { PortfolioView } from "@/components/portfolio-view";

export const metadata = { title: "Portfolio — Fairtape" };

export default function PortfolioPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
      <p className="muted mt-2 mb-8 max-w-2xl">
        Every tokenized share you own on Solana, Base and Robinhood Chain — counted in real shares, and flagged when another issuer would
        pay you more for the same stock.
      </p>
      <PortfolioView />
    </div>
  );
}
