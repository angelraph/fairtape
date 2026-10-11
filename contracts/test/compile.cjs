// Compiles FairtapeDesk into contracts/FairtapeDesk.json (and MockToken for the tests). Run from contracts/test:
//   npm i solc@0.8.26 ganache@7 viem && node compile.cjs && node FairtapeDesk.test.mjs
// Compiles FairtapeDesk (and the local-only MockToken) with solc 0.8.26, evm "paris" for broad chain support.
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const deskPath = path.join(__dirname, "..", "FairtapeDesk.sol");
const input = {
  language: "Solidity",
  sources: {
    "FairtapeDesk.sol": { content: fs.readFileSync(deskPath, "utf8") },
    "MockToken.sol": { content: fs.readFileSync(path.join(__dirname, "MockToken.sol"), "utf8") },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors || []).filter((e) => e.severity === "error");
for (const e of out.errors || []) console.log(e.severity.toUpperCase(), e.formattedMessage.trim());
if (errors.length) process.exit(1);

const desk = out.contracts["FairtapeDesk.sol"].FairtapeDesk;
const mock = out.contracts["MockToken.sol"].MockToken;
fs.writeFileSync(path.join(__dirname, "artifacts.json"), JSON.stringify({ desk: { abi: desk.abi, bytecode: "0x" + desk.evm.bytecode.object }, mock: { abi: mock.abi, bytecode: "0x" + mock.evm.bytecode.object } }));
// The app and deploy script use the desk artifact only.
fs.writeFileSync(
  path.join(__dirname, "..", "FairtapeDesk.json"),
  JSON.stringify({ compiler: solc.version(), evmVersion: "paris", optimizerRuns: 200, abi: desk.abi, bytecode: "0x" + desk.evm.bytecode.object }, null, 2) + "\n",
);
console.log("compiled: desk bytecode", desk.evm.bytecode.object.length / 2, "bytes");
