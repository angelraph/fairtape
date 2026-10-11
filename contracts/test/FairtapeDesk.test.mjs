// Local tests for FairtapeDesk on an in-memory chain. Run: node test.mjs
import fs from "node:fs";
import ganache from "ganache";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, keccak256, parseEther, defineChain, encodeFunctionData, decodeErrorResult,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const art = JSON.parse(fs.readFileSync(new URL("./artifacts.json", import.meta.url)));
const keys = [generatePrivateKey(), generatePrivateKey(), generatePrivateKey(), generatePrivateKey()];
const provider = ganache.provider({
  chain: { chainId: 1337, hardfork: "merge" },
  logging: { quiet: true },
  wallet: { accounts: keys.map((k) => ({ secretKey: k, balance: "0x" + (10n ** 21n).toString(16) })) },
});
const chain = defineChain({ id: 1337, name: "local", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://x"] } } });
const pub = createPublicClient({ chain, transport: custom(provider) });
const [ownerAcc, signerAcc, userAcc, merchantAcc] = keys.map((k) => privateKeyToAccount(k));
const wallet = (acc) => createWalletClient({ account: acc, chain, transport: custom(provider) });

let passed = 0;
let failed = 0;
const ok = (cond, name) => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
};
async function deploy(acc, a, args = []) {
  const hash = await wallet(acc).deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  return r.contractAddress;
}
async function send(acc, address, abi, functionName, args, value) {
  const hash = await wallet(acc).writeContract({ address, abi, functionName, args, value, gas: 500000n });
  return pub.waitForTransactionReceipt({ hash });
}
async function reverts(acc, address, abi, functionName, args, value, errName) {
  const data = encodeFunctionData({ abi, functionName, args });
  try {
    await provider.request({ method: "eth_call", params: [{ from: acc.address, to: address, data, value: value ? "0x" + value.toString(16) : undefined, gas: "0x7a120" }, "latest"] });
    return false;
  } catch (e) {
    const raw = e.data?.result ?? e.data ?? e.result;
    let name = null;
    try { name = decodeErrorResult({ abi, data: typeof raw === "string" ? raw : raw?.data }).errorName; } catch {}
    if (process.env.DEBUG) console.log("    revert:", functionName, "->", name, "|", e.message?.slice(0, 80));
    return errName ? name === errName : true;
  }
}
const bal = (token, who) => pub.readContract({ address: token, abi: art.mock.abi, functionName: "balanceOf", args: [who] });

// Mirrors what the Fairtape server does: hash the quote fields bound to this desk and chain, then sign that hash.
function hashQuote(desk, q) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
      [desk, 1337n, q.tokenIn, q.tokenOut, q.priceIn, q.priceOut, q.expiry],
    ),
  );
}
const sign = (acc, desk, q) => acc.signMessage({ message: { raw: hashQuote(desk, q) } });
const now = async () => (await pub.getBlock()).timestamp;

const ETH = "0x0000000000000000000000000000000000000000";
const usdc = await deploy(ownerAcc, art.mock);
const tsla = await deploy(ownerAcc, art.mock);
const desk = await deploy(ownerAcc, art.desk, [ownerAcc.address, signerAcc.address]);
const D = art.desk.abi;
const M = art.mock.abi;

// Inventory: 100 USDC, 10 TSLA, 1 ETH. User: 50 USDC, 5 TSLA.
await send(ownerAcc, usdc, M, "mint", [desk, parseEther("100")]);
await send(ownerAcc, tsla, M, "mint", [desk, parseEther("10")]);
await wallet(ownerAcc).sendTransaction({ to: desk, value: parseEther("1") });
await send(ownerAcc, usdc, M, "mint", [userAcc.address, parseEther("50")]);
await send(ownerAcc, tsla, M, "mint", [userAcc.address, parseEther("5")]);
await send(userAcc, usdc, M, "approve", [desk, parseEther("1000")]);
await send(userAcc, tsla, M, "approve", [desk, parseEther("1000")]);

// The server's hash must match the contract's own.
const t0 = await now();
{
  const q = { tokenIn: usdc, tokenOut: tsla, priceIn: parseEther("1"), priceOut: parseEther("381.64"), expiry: t0 + 120n };
  const onchain = await pub.readContract({ address: desk, abi: D, functionName: "quoteHash", args: [q] });
  ok(onchain === hashQuote(desk, q), "server quote hash matches the contract's quoteHash");
}

// 1. Buy TSLA with exactly 10 USDC at $381.64.
{
  const q = { tokenIn: usdc, tokenOut: tsla, priceIn: parseEther("1"), priceOut: parseEther("381.64"), expiry: t0 + 120n };
  const sig = await sign(signerAcc, desk, q);
  const before = await bal(tsla, userAcc.address);
  const r = await send(userAcc, desk, D, "swapExactIn", [q, sig, parseEther("10"), 0n, userAcc.address]);
  const got = (await bal(tsla, userAcc.address)) - before;
  const expected = (parseEther("10") * parseEther("1")) / parseEther("381.64");
  ok(r.status === "success" && got === expected, `exact-in: 10 USDC bought ${Number(got) / 1e18} TSLA at the real price`);
}

// 2. Pay a merchant exactly 1 USDC with TSLA.
{
  const q = { tokenIn: tsla, tokenOut: usdc, priceIn: parseEther("381.64"), priceOut: parseEther("1"), expiry: t0 + 120n };
  const sig = await sign(signerAcc, desk, q);
  const tBefore = await bal(tsla, userAcc.address);
  await send(userAcc, desk, D, "swapExactOut", [q, sig, parseEther("1"), parseEther("1"), merchantAcc.address]);
  const merchantGot = await bal(usdc, merchantAcc.address);
  const spent = tBefore - (await bal(tsla, userAcc.address));
  const expectedIn = (parseEther("1") * parseEther("1") + parseEther("381.64") - 1n) / parseEther("381.64");
  ok(merchantGot === parseEther("1"), "exact-out: merchant received exactly 1 USDC");
  ok(spent === expectedIn, `exact-out: payer spent ${Number(spent) / 1e18} TSLA (rounded up in the desk's favour)`);
}

// 3. Native ETH in, exact amount, at $2500.
{
  const q = { tokenIn: ETH, tokenOut: usdc, priceIn: parseEther("2500"), priceOut: parseEther("1"), expiry: t0 + 120n };
  const sig = await sign(signerAcc, desk, q);
  const before = await bal(usdc, userAcc.address);
  await send(userAcc, desk, D, "swapExactIn", [q, sig, parseEther("0.001"), 0n, userAcc.address], parseEther("0.001"));
  ok((await bal(usdc, userAcc.address)) - before === parseEther("2.5"), "ETH exact-in: 0.001 ETH bought exactly 2.5 USDC");
  ok(await reverts(userAcc, desk, D, "swapExactIn", [q, sig, parseEther("0.001"), 0n, userAcc.address], parseEther("0.002"), "BadAmount"), "ETH exact-in: sending more ETH than the amount is rejected");
}

// 4. Native ETH exact-out refunds the unused ETH.
{
  const q = { tokenIn: ETH, tokenOut: usdc, priceIn: parseEther("2500"), priceOut: parseEther("1"), expiry: t0 + 120n };
  const sig = await sign(signerAcc, desk, q);
  const deskEthBefore = await pub.getBalance({ address: desk });
  await send(userAcc, desk, D, "swapExactOut", [q, sig, parseEther("1"), parseEther("0.01"), merchantAcc.address], parseEther("0.01"));
  const deskGain = (await pub.getBalance({ address: desk })) - deskEthBefore;
  ok(deskGain === parseEther("0.0004"), "ETH exact-out: desk kept exactly 0.0004 ETH and refunded the rest");
}

// 5. ETH out.
{
  const q = { tokenIn: usdc, tokenOut: ETH, priceIn: parseEther("1"), priceOut: parseEther("2500"), expiry: t0 + 120n };
  const sig = await sign(signerAcc, desk, q);
  const before = await pub.getBalance({ address: merchantAcc.address });
  await send(userAcc, desk, D, "swapExactIn", [q, sig, parseEther("5"), 0n, merchantAcc.address]);
  ok((await pub.getBalance({ address: merchantAcc.address })) - before === parseEther("0.002"), "ETH out: 5 USDC delivered exactly 0.002 ETH");
}

// 6. Everything that must be refused.
{
  const good = { tokenIn: usdc, tokenOut: tsla, priceIn: parseEther("1"), priceOut: parseEther("381.64"), expiry: t0 + 120n };
  const goodSig = await sign(signerAcc, desk, good);
  const args = (q, sig, min = 0n) => [q, sig, parseEther("1"), min, userAcc.address];

  const expired = { ...good, expiry: t0 - 1n };
  ok(await reverts(userAcc, desk, D, "swapExactIn", args(expired, await sign(signerAcc, desk, expired)), undefined, "QuoteExpired"), "rejects an expired quote");
  ok(await reverts(userAcc, desk, D, "swapExactIn", args(good, await sign(userAcc, desk, good)), undefined, "BadSignature"), "rejects a quote signed by anyone but the price signer");
  ok(await reverts(userAcc, desk, D, "swapExactIn", args({ ...good, priceOut: parseEther("1") }, goodSig), undefined, "BadSignature"), "rejects a quote whose price was tampered with");
  const otherDesk = await deploy(ownerAcc, art.desk, [ownerAcc.address, signerAcc.address]);
  ok(await reverts(userAcc, otherDesk, D, "swapExactIn", args(good, goodSig), undefined, "BadSignature"), "a quote for one desk can't be replayed on another");
  ok(await reverts(userAcc, desk, D, "swapExactIn", args(good, goodSig, parseEther("1")), undefined, "SlippageExceeded"), "rejects a fill below the payer's minimum");
  const huge = [good, goodSig, parseEther("40"), 0n, userAcc.address];
  await send(ownerAcc, usdc, M, "mint", [userAcc.address, parseEther("10000")]);
  ok(await reverts(userAcc, desk, D, "swapExactIn", [good, goodSig, parseEther("5000"), 0n, userAcc.address], undefined, "InsufficientInventory"), "rejects a fill bigger than the desk's inventory");
  ok(!(await reverts(userAcc, desk, D, "swapExactIn", huge)), "a fill within inventory still works");
  ok(await reverts(userAcc, desk, D, "withdraw", [usdc, userAcc.address, 1n], undefined, "NotOwner"), "only the owner can withdraw");
  const before = await bal(usdc, ownerAcc.address);
  await send(ownerAcc, desk, D, "withdraw", [usdc, ownerAcc.address, parseEther("1")]);
  ok((await bal(usdc, ownerAcc.address)) - before === parseEther("1"), "owner can withdraw inventory");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
