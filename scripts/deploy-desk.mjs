// Deploys FairtapeDesk to Robinhood Chain Testnet.
// Usage: node scripts/deploy-desk.mjs <owner address>
// The deployer is the DESK_SIGNER_KEY account from .env.local (it also signs price quotes). The owner, who alone can
// withdraw inventory or change the signer, is the address you pass in.
import fs from "node:fs";
import { createPublicClient, createWalletClient, defineChain, formatEther, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const owner = getAddress(process.argv[2]);
const signer = privateKeyToAccount(env.DESK_SIGNER_KEY);
const artifact = JSON.parse(fs.readFileSync(new URL("../contracts/FairtapeDesk.json", import.meta.url), "utf8"));

const chain = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
});
const transport = http(undefined, { retryCount: 6, retryDelay: 1500, timeout: 60_000 });
const pub = createPublicClient({ chain, transport });
const wallet = createWalletClient({ account: signer, chain, transport });

const balance = await pub.getBalance({ address: signer.address });
console.log(`deployer ${signer.address} has ${formatEther(balance)} test ETH`);
if (balance === 0n) {
  console.log("Send a little test ETH to the deployer first.");
  process.exit(1);
}

const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args: [owner, signer.address] });
console.log("deploy tx", hash);
const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
if (receipt.status !== "success") throw new Error("deploy reverted");
const desk = receipt.contractAddress;
const [onchainOwner, onchainSigner] = await Promise.all([
  pub.readContract({ address: desk, abi: artifact.abi, functionName: "owner" }),
  pub.readContract({ address: desk, abi: artifact.abi, functionName: "signer" }),
]);
console.log(`desk ${desk}\nowner ${onchainOwner}\nsigner ${onchainSigner}`);
