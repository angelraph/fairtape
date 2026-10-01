import { createConfig, http } from "wagmi";
import { injected, baseAccount } from "wagmi/connectors";
import { base, robinhood, BASE_RPC } from "./chains";

export const wagmiConfig = createConfig({
  chains: [base, robinhood],
  connectors: [injected({ shimDisconnect: true }), baseAccount({ appName: "Fairtape" })],
  transports: {
    [base.id]: http(BASE_RPC),
    [robinhood.id]: http(robinhood.rpcUrls.default.http[0]),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
