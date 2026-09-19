import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { HelpChat } from "@/components/HelpChat";
import { isDemoMode } from "@/lib/local-mode";
import Link from "next/link";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CampusPulse",
  description: "Anonymous campus issue desk. No account. No name. Just the issue.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${fraunces.variable} ${sourceSans.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="font-sans antialiased">
        <a href="#main-content" className="cp-skip-link">Skip to content</a>
        <Header />
        {isDemoMode() && <aside className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm text-navy">Demo campus · sample data, real workflows. <Link href="/demo" className="font-bold underline">Accounts &amp; walkthrough →</Link></aside>}
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 outline-none md:px-6 md:pt-7">{children}</main>
        <HelpChat />
      </body>
    </html>
  );
}
