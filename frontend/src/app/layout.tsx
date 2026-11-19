import "./globals.css";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";

// 900 is included so font-extrabold/black still render heavier than the bold body text.
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-roboto", display: "swap" });

export const metadata: Metadata = {
  title: "FSID",
  description: "Industrial Energy Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className={roboto.className}>
        {children}
      </body>
    </html>
  );
}
