import type { Metadata } from "next";
import "./globals.css";
import { Web3Providers } from "../components/web3/Web3Providers";

export const metadata: Metadata = {
  title: "Cryogenic Room",
  description: "A pixel-arcade cryogenic laboratory for assembling and generating NFT specimens.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Web3Providers>{children}</Web3Providers></body>
    </html>
  );
}
