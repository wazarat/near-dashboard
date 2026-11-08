"use client";

import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <NuqsAdapter>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
