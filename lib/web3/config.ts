import { createStorage, cookieStorage, createConfig, http } from "wagmi";
import { mainnet, base, polygon } from "wagmi/chains";
import { defineChain } from "viem";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, rainbowWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: { name: "Robinhood Chain Explorer", url: "https://robinhoodchain.blockscout.com" },
  },
});

export const arcChain = defineChain({
  id: 5042002,
  name: "ARC Chain",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: {
    default: { name: "ARC Explorer", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const PRIMARY_CHAIN = mainnet;

export const SUPPORTED_CHAINS = [
  mainnet,
  base,
  polygon,
  robinhood,
  arcChain,
] as const;

export const CHAIN_BADGE_LABELS: Record<number, string> = {
  [mainnet.id]: "ETHEREUM",
  [base.id]: "BASE",
  [polygon.id]: "POLYGON",
  [robinhood.id]: "ROBINHOOD",
  [arcChain.id]: "ARC CHAIN",
};

export function getChainBadgeLabel(chainId: number, fallbackName?: string) {
  return CHAIN_BADGE_LABELS[chainId] ?? (fallbackName ? fallbackName.toUpperCase() : `CHAIN ${chainId}`);
}

function readProjectId() {
  return process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim() || "";
}

export const WC_PROJECT_ID = readProjectId();
export const HAS_WALLETCONNECT_PROJECT_ID = Boolean(
  WC_PROJECT_ID && WC_PROJECT_ID !== "MISSING_WC_PROJECT_ID",
);
const WALLETCONNECT_PROJECT_ID_FOR_SDK = HAS_WALLETCONNECT_PROJECT_ID
  ? WC_PROJECT_ID
  : "00000000000000000000000000000000";

export const APP_NAME = "Cryogenic Room";

export function getWagmiConfig() {
  const connectors = connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [metaMaskWallet, rainbowWallet, walletConnectWallet],
      },
    ],
    {
      appName: APP_NAME,
      projectId: WALLETCONNECT_PROJECT_ID_FOR_SDK,
    },
  );

  const transports = Object.fromEntries(
    SUPPORTED_CHAINS.map((chain) => [chain.id, http()]),
  ) as Record<(typeof SUPPORTED_CHAINS)[number]["id"], ReturnType<typeof http>>;

  return createConfig({
    connectors,
    chains: SUPPORTED_CHAINS,
    transports,
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
  });
}

export type CryogenicWagmiConfig = ReturnType<typeof getWagmiConfig>;
