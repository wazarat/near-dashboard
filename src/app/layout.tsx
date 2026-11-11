import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AtlasShell } from "@/components/layout/atlas-shell";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { AccessProvider } from "@/lib/access";
import { AUTH_ENABLED, CLERK_PUBLISHABLE_KEY, warnIfAuthOff } from "@/lib/auth-config";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { meta } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { OG_BASE, SITE } from "@/lib/site";

/* Self-hosted latin variable cuts (see src/app/fonts/LICENSE.txt) so a build needs no network. */
const sans = localFont({ src: "./fonts/inter-latin-wght-normal.woff2", variable: "--font-sans", weight: "100 900", display: "swap" });
const display = localFont({ src: "./fonts/space-grotesk-latin-wght-normal.woff2", variable: "--font-display", weight: "300 700", display: "swap" });
const mono = localFont({ src: "./fonts/jetbrains-mono-latin-wght-normal.woff2", variable: "--font-mono", weight: "100 800", display: "swap" });

const DESCRIPTION = `Independent research by CanHav Research on ${meta.counts.projects} projects in the NEAR and Aurora ecosystem. Traction, funding, security, chain activity and NEAR Intents volume, data as of ${meta.asOfLabel}.`;

/** Canonical URLs, Open Graph and the Twitter card all read NEXT_PUBLIC_SITE_URL (standard section 12). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE.title, template: SITE.template },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { ...OG_BASE, title: SITE.title, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: SITE.title, description: DESCRIPTION, images: ["/og.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  warnIfAuthOff();
  const page = (
    <Providers>
      <AccessProvider>
        <SiteHeader />
        <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
          <AtlasShell>{children}</AtlasShell>
        </Suspense>
        <SiteFooter />
      </AccessProvider>
    </Providers>
  );
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {/* One Clerk application serves canhav.com and the atlases. Without its key the provider is left out and the login wall is off. */}
        {AUTH_ENABLED ? (
          <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} appearance={clerkAppearance} afterSignOutUrl="/">
            {page}
          </ClerkProvider>
        ) : (
          page
        )}
        {/* Vercel Web Analytics: page views plus the custom events in src/lib/track.ts. Cookieless. Only on Vercel
            (VERCEL=1 at build): elsewhere its script path does not exist and the 404 breaks local and CI checks.
            It reads the search params to name the route, so it has its own Suspense boundary for static pages. */}
        {process.env.VERCEL && (
          <Suspense fallback={null}>
            <Analytics />
          </Suspense>
        )}
      </body>
    </html>
  );
}
