"use client";

import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { useSolanaWallet } from "../solana-wallet";
import { useTestHoldings } from "../use-test-holdings";
import { WalletBar, short } from "../connect";
import { FAUCETS, TEST_CHAIN_LABEL, TEST_EXPLORER, type TestChain } from "@/lib/testnet";
import { amount as fmtAmount } from "@/lib/format";

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`w-6 h-6 rounded-full grid place-items-center text-xs flex-none ${done ? "bg-pos text-bg" : "border border-line muted"}`}>
        {done ? "✓" : n}
      </span>
      <div className="min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="small muted mt-0.5">{children}</div>
      </div>
    </li>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="underline hover:text-text" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function TestWallet() {
  const evm = useAccount();
  const sol = useSolanaWallet();
  const { data, isLoading } = useTestHoldings();
  const h = data?.holdings ?? [];
  const has = (chain: TestChain, kind?: string) => h.some((x) => x.chain === chain && x.amount > 0 && (!kind || x.kind === kind));

  const chains: TestChain[] = ["robinhood", "base", "solana"];
  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      <div className="panel p-5">
        <div className="font-medium mb-4">Get set up (free, about 10 minutes)</div>
        <ol className="grid gap-4">
          <Step n={1} done={Boolean(evm.address)} title="Connect OKX Wallet, MetaMask or Rabby">
            Pick it by name in the wallet list. Phantom can&apos;t add Robinhood Chain, so use it for Solana only.
          </Step>
          <Step n={2} done={Boolean(sol.account)} title="Connect Phantom (optional, for Solana Devnet)">
            In Phantom: Settings → Developer Settings → Testnet Mode on.
          </Step>
          <Step n={3} done={has("robinhood", "native") && has("robinhood", "stock")} title="Claim test ETH + test stocks">
            <Ext href={FAUCETS.robinhood}>Robinhood Chain faucet</Ext>: gas plus TSLA, AMZN, AMD, PLTR, NFLX.
          </Step>
          <Step n={4} done={has("base", "stable") || has("solana", "stable")} title="Claim test USDC (for pay links)">
            <Ext href={FAUCETS.circle}>Circle faucet</Ext>: USDC on Base Sepolia and/or Solana Devnet. Gas:{" "}
            <Ext href={FAUCETS.baseEth}>Base Sepolia ETH</Ext>, <Ext href={FAUCETS.solana}>devnet SOL</Ext>.
          </Step>
        </ol>
        {!evm.address && !sol.account && (
          <div className="mt-5">
            <WalletBar />
          </div>
        )}
      </div>

      <div className="panel p-5">
        <div className="font-medium mb-4">Your testnet balances</div>
        {!evm.address && !sol.account && <p className="small muted">Connect a wallet to see balances on all three testnets.</p>}
        {isLoading && <div className="skeleton h-32" />}
        {data && (
          <div className="grid gap-4">
            {chains.map((c) => {
              const rows = h.filter((x) => x.chain === c);
              if (!rows.length) return null;
              const owner = c === "solana" ? sol.account?.address : evm.address;
              return (
                <div key={c}>
                  <div className="flex items-center gap-2 small muted mb-1.5">
                    <span className={`chain-dot chain-${c}`} /> {TEST_CHAIN_LABEL[c]}
                    {owner && (
                      <a className="ml-auto underline hover:text-text num" href={TEST_EXPLORER[c].address(owner)} target="_blank" rel="noreferrer">
                        {short(owner)} ↗
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rows.map((x) => (
                      <span key={x.token} className={`chip num ${x.amount > 0 ? "text-text" : ""}`}>
                        {fmtAmount(x.amount, x.amount > 0 && x.amount < 1 ? 6 : 2)} {x.symbol}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {data.errors.map((e) => (
              <p key={e} className="small warn">{e}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
