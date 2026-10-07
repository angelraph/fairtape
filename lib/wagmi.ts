import { createConfig, http } from "wagmi";
import { injected, baseAccount } from "wagmi/connectors";
import { base, robinhood, BASE_RPC } from "./chains";
import { robinhoodTestnet, baseSepolia, BASE_SEPOLIA_RPC } from "./testnet";

export const wagmiConfig = createConfig({
  chains: [base, robinhood, robinhoodTestnet, baseSepolia],
  connectors: [injected({ shimDisconnect: true }), baseAccount({ appName: "Fairtape" })],
  transports: {
    [base.id]: http(BASE_RPC),
    [robinhood.id]: http(robinhood.rpcUrls.default.http[0]),
    [robinhoodTestnet.id]: http(robinhoodTestnet.rpcUrls.default.http[0], { retryCount: 6, retryDelay: 1200 }),
    [baseSepolia.id]: http(BASE_SEPOLIA_RPC, { retryCount: 6, retryDelay: 1200 }),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
