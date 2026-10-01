import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { WalletBar } from "@/components/connect";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fairtape — the consolidated tape for onchain stocks",
  description:
    "One NVDA, four issuers, three chains. Fairtape compares tokenized stocks per real share across Solana, Base and Robinhood Chain, routes you to the best print, and lets you pay with stocks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="border-b border-line sticky top-0 z-40 bg-bg/90 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <Logo />
                Fairtape
              </Link>
              <nav className="hidden sm:flex items-center gap-5 text-sm text-muted">
                <Link href="/" className="hover:text-text">Tape</Link>
                <Link href="/trade" className="hover:text-text">Trade</Link>
                <Link href="/pay" className="hover:text-text">Pay</Link>
                <Link href="/portfolio" className="hover:text-text">Portfolio</Link>
              </nav>
              <div className="ml-auto">
                <WalletBar />
              </div>
            </div>
            <nav className="sm:hidden flex items-center gap-5 text-sm text-muted px-4 pb-2">
              <Link href="/">Tape</Link>
              <Link href="/trade">Trade</Link>
              <Link href="/pay">Pay</Link>
              <Link href="/portfolio">Portfolio</Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line mt-16">
            <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-faint flex flex-wrap gap-x-6 gap-y-2">
              <span>Non-custodial. Prices from Jupiter, Uniswap, Aerodrome, Chainlink and Robinhood market data.</span>
              <span>Tokenized stocks are not available to US persons. Not investment advice.</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#3ddc97" />
      <path d="M6 15.5h3l2-6 2.5 9 2-5H18" stroke="#04130c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
