import type { Metadata } from "next";
import Link from "next/link";
import { Sora, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { WalletBar } from "@/components/connect";
import { Wordmark, FullLogo } from "@/components/brand";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Fairtape — Pay anyone. In public markets.",
  description:
    "The consolidated tape and checkout for tokenized stocks. One share, four issuers, three chains: Fairtape prices every one per real share, routes you to the best print, and lets anyone settle a USDC invoice with stocks.",
};

const NAV = [
  { href: "/", label: "Tape" },
  { href: "/trade", label: "Trade" },
  { href: "/pay", label: "Pay" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/docs", label: "Docs" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} ${geistMono.variable} ${serif.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-bg/70 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-6">
              <Link href="/" aria-label="Fairtape home" className="shrink-0">
                <Wordmark height={20} />
              </Link>
              <nav className="hidden md:flex items-center gap-1 text-sm">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="nav-link">{n.label}</Link>
                ))}
                <Link href="/test" className="chip !h-7 !px-3 !border-warn/40 warn hover:bg-warn/10 ml-2">Testnet · $0</Link>
              </nav>
              <div className="ml-auto">
                <WalletBar />
              </div>
            </div>
            <nav className="md:hidden flex items-center gap-1 text-sm px-3 pb-2 overflow-x-auto">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="nav-link shrink-0">{n.label}</Link>
              ))}
              <Link href="/test" className="nav-link warn shrink-0">Testnet</Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line mt-8 bg-bg-2/60">
            <div className="mx-auto max-w-6xl px-4 py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div>
                <FullLogo width={240} />
                <p className="small faint mt-5 max-w-xs leading-relaxed">
                  Non-custodial software. Prices from Jupiter, Uniswap, Aerodrome, Chainlink and Robinhood market data.
                </p>
              </div>
              <FooterCol title="Product" links={[["Consolidated tape", "/"], ["Best print", "/trade"], ["Pay links", "/pay"], ["Portfolio", "/portfolio"]]} />
              <FooterCol title="Build" links={[["Documentation", "/docs"], ["API", "/docs#api"], ["Contracts", "/docs#contracts"], ["Roadmap", "/docs#roadmap"]]} />
              <FooterCol title="Try it" links={[["Testnet hub", "/test"], ["Testnet trading", "/test/trade"], ["Test pay link", "/pay/new?net=test"], ["FAQ", "/docs#faq"]]} />
            </div>
            <div className="border-t border-line">
              <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-faint flex flex-wrap gap-x-6 gap-y-2 justify-between">
                <span>Tokenized stocks are not available to US persons and are restricted in some other jurisdictions. Not investment advice.</span>
                <span>© 2026 Fairtape</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="small faint uppercase tracking-[0.16em]">{title}</div>
      <ul className="mt-4 grid gap-2.5 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="muted hover:text-text transition-colors">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
