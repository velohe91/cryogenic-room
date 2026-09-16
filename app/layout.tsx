import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cryogenic Room",
  description: "A pixel-arcade cryogenic laboratory for assembling and generating NFT specimens.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
