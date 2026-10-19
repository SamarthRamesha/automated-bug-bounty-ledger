import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bug Bounty Patch & Payout Ledger",
  description: "Academic DBMS project foundation"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
