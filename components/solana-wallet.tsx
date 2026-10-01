"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useWallets, useConnect, useDisconnect, type UiWallet, type UiWalletAccount } from "@wallet-standard/react";
import { SolanaSignAndSendTransaction } from "@solana/wallet-standard-features";
import { useSignAndSendTransaction } from "@solana/react";
import { getBase58Decoder } from "@solana/kit";

const STORAGE_KEY = "fairtape:solana-wallet";

// Signs a fully built, serialized transaction (from Jupiter / LI.FI) and returns its base58 signature.
export type SolanaSender = (transaction: Uint8Array) => Promise<string>;

type Ctx = {
  wallets: readonly UiWallet[];
  wallet: UiWallet | null;
  account: UiWalletAccount | null;
  select: (wallet: UiWallet, account: UiWalletAccount) => void;
  clear: () => void;
  send: SolanaSender | null;
};

function SenderBridge({ account, onReady }: { account: UiWalletAccount; onReady: (s: SolanaSender) => void }) {
  const signAndSend = useSignAndSendTransaction(account, "solana:mainnet");
  useEffect(() => {
    onReady(async (transaction) => {
      const { signature } = await signAndSend({ transaction });
      return getBase58Decoder().decode(signature);
    });
  }, [signAndSend, onReady]);
  return null;
}

const SolanaWalletContext = createContext<Ctx | null>(null);

function isSolanaWallet(w: UiWallet) {
  return w.chains.some((c) => c.startsWith("solana:")) && w.features.includes(SolanaSignAndSendTransaction);
}

// The remembered wallet lives in localStorage; read it as an external store so SSR renders "disconnected".
const listeners = new Set<() => void>();
const storedSelection = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(value: string | null) {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
    listeners.forEach((l) => l());
  },
};

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const all = useWallets();
  const wallets = useMemo(() => all.filter(isSolanaWallet), [all]);
  const raw = useSyncExternalStore(storedSelection.subscribe, storedSelection.get, () => null);
  const selected = useMemo<{ wallet: string; address: string } | null>(() => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [raw]);

  const wallet = wallets.find((w) => w.name === selected?.wallet) ?? null;
  const account = wallet?.accounts.find((a) => a.address === selected?.address) ?? wallet?.accounts[0] ?? null;

  const select = useCallback((w: UiWallet, a: UiWalletAccount) => {
    storedSelection.set(JSON.stringify({ wallet: w.name, address: a.address }));
  }, []);
  const clear = useCallback(() => storedSelection.set(null), []);

  const [send, setSend] = useState<SolanaSender | null>(null);
  const onReady = useCallback((s: SolanaSender) => setSend(() => s), []);
  const canSend = account?.chains.includes("solana:mainnet") ?? false;

  return (
    <SolanaWalletContext.Provider value={{ wallets, wallet, account, select, clear, send: canSend ? send : null }}>
      {account && canSend && <SenderBridge key={account.address} account={account} onReady={onReady} />}
      {children}
    </SolanaWalletContext.Provider>
  );
}

export function useSolanaWallet() {
  const ctx = useContext(SolanaWalletContext);
  if (!ctx) throw new Error("useSolanaWallet outside provider");
  return ctx;
}

export function SolanaWalletOption({ wallet, onDone }: { wallet: UiWallet; onDone?: () => void }) {
  const { select } = useSolanaWallet();
  const [isConnecting, connect] = useConnect(wallet);
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      className="wallet-option"
      disabled={isConnecting}
      onClick={async () => {
        setError(null);
        try {
          const accounts = await connect();
          if (accounts[0]) {
            select(wallet, accounts[0]);
            onDone?.();
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Connection rejected");
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={wallet.icon} alt="" width={22} height={22} />
      <span>{wallet.name}</span>
      {isConnecting && <span className="muted">connecting…</span>}
      {error && <span className="neg small">{error}</span>}
    </button>
  );
}

export function SolanaDisconnect({ wallet }: { wallet: UiWallet }) {
  const { clear } = useSolanaWallet();
  const [, disconnect] = useDisconnect(wallet);
  return (
    <button
      className="link-button"
      onClick={async () => {
        try {
          await disconnect();
        } catch {}
        clear();
      }}
    >
      Disconnect
    </button>
  );
}
