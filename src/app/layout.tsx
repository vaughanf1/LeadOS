import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "One Stop 4 Equity Release — Lead Distribution",
  description: "Equity release lead distribution",
  icons: { icon: "/os4er-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
