"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useSolanaWallet, SolanaWalletOption, SolanaDisconnect } from "./solana-wallet";

export function short(addr?: string | null, n = 4) {
  if (!addr) return "";
  return `${addr.slice(0, n + (addr.startsWith("0x") ? 2 : 0))}…${addr.slice(-n)}`;
}

export function WalletBar() {
  const [open, setOpen] = useState(false);
  const evm = useAccount();
  const sol = useSolanaWallet();
  const connectedCount = (evm.address ? 1 : 0) + (sol.account ? 1 : 0);

  return (
    <>
      <button className={connectedCount ? "btn" : "btn btn-primary"} onClick={() => setOpen(true)}>
        {connectedCount === 0 && "Connect wallets"}
        {sol.account && (
          <span className="flex items-center gap-1.5">
            <span className="chain-dot chain-solana" />
            <span className="num">{short(sol.account.address)}</span>
          </span>
        )}
        {evm.address && (
          <span className="flex items-center gap-1.5">
            <span className="chain-dot chain-base" />
            <span className="chain-dot chain-robinhood -ml-1" />
            <span className="num">{short(evm.address)}</span>
          </span>
        )}
      </button>
      {open && <ConnectDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function ConnectDialog({ onClose }: { onClose: () => void }) {
  const evm = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const sol = useSolanaWallet();

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog panel p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Wallets</h2>
          <button className="link-button" onClick={onClose}>Close</button>
        </div>

        <section className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label flex items-center gap-2 !mb-0">
              <span className="chain-dot chain-solana" /> Solana — xStocks, Ondo
            </span>
            {sol.wallet && <SolanaDisconnect wallet={sol.wallet} />}
          </div>
          {sol.account ? (
            <div className="wallet-option">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {sol.wallet && <img src={sol.wallet.icon} alt="" width={22} height={22} />}
              <span className="num">{short(sol.account.address, 6)}</span>
              <span className="pos small ml-auto">connected</span>
            </div>
          ) : sol.wallets.length ? (
            <div className="grid gap-2">
              {sol.wallets.map((w) => (
                <SolanaWalletOption key={w.name} wallet={w} />
              ))}
            </div>
          ) : (
            <p className="small muted">
              No Solana wallet detected. Install{" "}
              <a className="underline" href="https://phantom.com" target="_blank" rel="noreferrer">Phantom</a> or{" "}
              <a className="underline" href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a>.
            </p>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="label flex items-center gap-2 !mb-0">
              <span className="chain-dot chain-base" />
              <span className="chain-dot chain-robinhood" /> Base + Robinhood Chain — Coinbase, Robinhood
            </span>
            {evm.address && <button className="link-button" onClick={() => disconnect()}>Disconnect</button>}
          </div>
          {evm.address ? (
            <div className="wallet-option">
              <span className="num">{short(evm.address, 6)}</span>
              <span className="small muted">{evm.connector?.name}</span>
              <span className="pos small ml-auto">connected</span>
            </div>
          ) : (
            <div className="grid gap-2">
              {connectors.map((c) => (
                <button key={c.uid} className="wallet-option" disabled={isPending} onClick={() => connect({ connector: c })}>
                  {c.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon} alt="" width={22} height={22} />
                  )}
                  <span>{c.name === "Injected" ? "Browser wallet (MetaMask, Rabby…)" : c.name}</span>
                </button>
              ))}
              {error && <p className="small neg">{error.message.split("\n")[0]}</p>}
            </div>
          )}
        </section>

        <p className="small faint mt-5">
          Fairtape never holds funds. Every transaction is built by public routers and signed in your own wallet.
        </p>
      </div>
    </div>
  );
}
