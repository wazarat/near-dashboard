import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AtlasShell } from "@/components/layout/atlas-shell";
import { meta } from "@/lib/data";

/* Self-hosted latin variable cuts (see src/app/fonts/LICENSE.txt) so a build needs no network. */
const sans = localFont({ src: "./fonts/inter-latin-wght-normal.woff2", variable: "--font-sans", weight: "100 900", display: "swap" });
const display = localFont({ src: "./fonts/space-grotesk-latin-wght-normal.woff2", variable: "--font-display", weight: "300 700", display: "swap" });
const mono = localFont({ src: "./fonts/jetbrains-mono-latin-wght-normal.woff2", variable: "--font-mono", weight: "100 800", display: "swap" });

export const metadata: Metadata = {
  title: { default: "CanHav Atlas, NEAR and Aurora", template: "%s · CanHav Atlas" },
  description: `Independent research by CanHav Research on ${meta.counts.projects} projects in the NEAR and Aurora ecosystem. Traction, funding, security, chain activity and NEAR Intents volume, data as of ${meta.asOfLabel}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>
          <SiteHeader />
          <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
            <AtlasShell>{children}</AtlasShell>
          </Suspense>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
