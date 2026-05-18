import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadOS",
  description: "Equity release lead distribution",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
