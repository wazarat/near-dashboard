import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AtlasShell } from "@/components/layout/atlas-shell";
import { meta } from "@/lib/data";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "NEAR Ecosystem Atlas", template: "%s · NEAR Ecosystem Atlas" },
  description: `Independent research by CanHav Research on ${meta.counts.projects} projects in the NEAR and Aurora ecosystem: traction, funding, security, chain activity and NEAR Intents volume. Data as of ${meta.asOfLabel}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
