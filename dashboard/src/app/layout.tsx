import type { Metadata } from "next";
import { Outfit, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Shadow Proxy — Private x402 Gateway",
  description:
    "Private x402 payment gateway for AI agents on Solana via MagicBlock PER",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${ibmPlexMono.variable} font-[family-name:var(--font-heading)] antialiased bg-[#F7F8F8] text-[#272D3E] min-h-screen`}
      >
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
