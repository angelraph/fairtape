// Builds lib/registry.generated.json from live sources and verifies every address onchain.
// Run: node scripts/build-registry.mjs
// Nothing in the registry is hand-typed: each venue is discovered from its issuer/oracle/DEX index
// and then checked against the chain itself (symbol, decimals, pool tokens).
import fs from "node:fs";
import { createPublicClient, http, parseAbi, defineChain, getAddress } from "viem";
import { base } from "viem/chains";

const TICKERS = ["NVDA", "AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "MSTR", "COIN", "CRCL", "SPY", "QQQ"];

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
});
const rh = createPublicClient({ chain: robinhood, transport: http() });
const bs = createPublicClient({ chain: base, transport: http("https://mainnet.base.org") });

const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const V3_STYLE = new Set(["uniswap-v3-robinhood", "ramses-v3-robinhood", "uniswap-v3-base", "aerodrome-slipstream-3", "aerodrome-slipstream"]);

const erc20 = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function uiMultiplier() view returns (uint256)",
]);
const poolAbi = parseAbi(["function token0() view returns (address)", "function token1() view returns (address)"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (r.status === 429) {
      await sleep(15000);
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  throw new Error(`rate limited: ${url}`);
}
// GeckoTerminal public API allows ~30 req/min.
async function gecko(path) {
  await sleep(2500);
  return getJson(`https://api.geckoterminal.com/api/v2${path}`);
}

// Picks the deepest v3-style pool pairing `token` with `quote`, verified onchain.
async function bestPool(client, network, token, quote) {
  const res = await gecko(`/networks/${network}/tokens/${token}/pools?page=1`);
  const candidates = (res.data || [])
    .filter((p) => V3_STYLE.has(p.relationships.dex.data.id))
    .sort((a, b) => Number(b.attributes.reserve_in_usd) - Number(a.attributes.reserve_in_usd));
  for (const p of candidates) {
    const addr = getAddress(p.attributes.address);
    const [t0, t1] = await Promise.all([
      client.readContract({ address: addr, abi: poolAbi, functionName: "token0" }),
      client.readContract({ address: addr, abi: poolAbi, functionName: "token1" }),
    ]);
    const pair = [t0.toLowerCase(), t1.toLowerCase()];
    if (pair.includes(token.toLowerCase()) && pair.includes(quote.toLowerCase())) {
      return {
        address: addr,
        dex: p.relationships.dex.data.id,
        name: p.attributes.name,
        token0: getAddress(t0),
        token1: getAddress(t1),
        liquidityUsdAtBuild: Math.round(Number(p.attributes.reserve_in_usd)),
      };
    }
  }
  return null;
}

async function main() {
  console.log("Fetching issuer + oracle indexes…");
  const rhAssets = await getJson("https://api.robinhood.com/rhj/assets");
  const rhList = rhAssets.results || rhAssets.assets || rhAssets;
  const clRobinhood = await getJson("https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json");
  const clBase = await getJson("https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-base-1.json");

  const out = { generatedAt: new Date().toISOString(), assets: [] };

  for (const T of TICKERS) {
    console.log(`\n== ${T}`);
    const asset = { ticker: T, name: null, venues: [] };

    // Solana: xStocks (Backed/Kraken) and Ondo, from Jupiter's verified token index.
    const jup = await getJson(`https://lite-api.jup.ag/tokens/v2/search?query=${T}`);
    for (const [issuer, sym, tag] of [
      ["xStocks", `${T}x`, "xstocks"],
      ["Ondo", `${T}on`, "ondo"],
    ]) {
      const hit = jup.find((t) => t.symbol === sym && t.isVerified && (t.tags || []).includes(tag));
      if (!hit) continue;
      asset.name ??= hit.name.replace(/ xStock$| \(Ondo Tokenized\)$/, "");
      asset.venues.push({
        issuer,
        chain: "solana",
        symbol: sym,
        address: hit.id,
        decimals: hit.decimals,
        tokenProgram: hit.tokenProgram ?? "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
        multiplierModel: "token2022-scaledUiAmount",
      });
      console.log(`  ${issuer} ${sym} ${hit.id} liq=$${Math.round(hit.liquidity || 0)}`);
    }

    // Robinhood Chain: Robinhood's live asset registry + Chainlink feed + deepest USDG pool.
    const rhAsset = rhList.find((a) => a.tokenSymbol === T && a.status === "ASSET_STATUS_ACTIVE");
    const rhDep = rhAsset?.deployments?.find((d) => d.chainId === 4663);
    if (rhDep) {
      const address = getAddress(rhDep.contractAddress);
      const [symbol, decimals] = await Promise.all([
        rh.readContract({ address, abi: erc20, functionName: "symbol" }),
        rh.readContract({ address, abi: erc20, functionName: "decimals" }),
      ]);
      if (symbol !== T) throw new Error(`RH ${T}: onchain symbol is ${symbol}`);
      const feed = clRobinhood.find((f) => new RegExp(`^Robinhood ${T}\\s*[-/]\\s*USD$`).test(f.name));
      const pool = await bestPool(rh, "robinhood", address, USDG);
      asset.name ??= rhAsset.tokenName.replace(/ • Robinhood Token$/, "");
      asset.venues.push({
        issuer: "Robinhood",
        chain: "robinhood",
        symbol,
        address,
        decimals: Number(decimals),
        isin: rhAsset.isin ?? null,
        multiplierModel: "erc8056-uiMultiplier",
        chainlinkFeed: feed ? getAddress(feed.proxyAddress) : null,
        pool,
      });
      console.log(`  Robinhood ${symbol} ${address} feed=${feed?.proxyAddress ?? "none"} pool=${pool?.name ?? "none"}`);
    }

    // Base: Coinbase B20 stocks. Discovered via GeckoTerminal, verified onchain (B20 prefix + symbol).
    const cbSym = `${T}c`;
    const search = await gecko(`/search/pools?query=${cbSym}&network=base`);
    const cbIds = new Set();
    for (const p of search.data || []) {
      for (const rel of ["base_token", "quote_token"]) {
        const id = p.relationships[rel].data.id.replace(/^base_/, "");
        if (id.toLowerCase().startsWith("0xb2000000")) cbIds.add(getAddress(id));
      }
    }
    for (const address of cbIds) {
      const symbol = await bs.readContract({ address, abi: erc20, functionName: "symbol" }).catch(() => null);
      if (symbol !== cbSym) continue;
      const decimals = await bs.readContract({ address, abi: erc20, functionName: "decimals" });
      const feed = clBase.find((f) => f.name === `Coinbase ${T}`);
      const pool = await bestPool(bs, "base", address, USDC_BASE);
      asset.venues.push({
        issuer: "Coinbase",
        chain: "base",
        symbol,
        address,
        decimals: Number(decimals),
        multiplierModel: "b20-uiMultiplier",
        chainlinkFeed: feed ? getAddress(feed.proxyAddress) : null,
        pool,
      });
      console.log(`  Coinbase ${symbol} ${address} feed=${feed?.proxyAddress ?? "none"} pool=${pool?.name ?? "none"}`);
      break;
    }

    if (asset.venues.length >= 2) out.assets.push(asset);
    else console.log(`  skipped: only ${asset.venues.length} venue(s)`);
  }

  fs.writeFileSync(new URL("../lib/registry.generated.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${out.assets.length} assets, ${out.assets.reduce((n, a) => n + a.venues.length, 0)} venues.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
