import Link from "next/link";
import { FAUCETS } from "@/lib/testnet";

/** The two places to get free test funds, shown on every testnet screen. */
export function TestFunds({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      <a href={FAUCETS.robinhood} target="_blank" rel="noreferrer" className="btn">
        Get test ETH ↗
      </a>
      <Link href="/test#get-usdc" className="btn">
        Get test USDC
      </Link>
    </div>
  );
}
