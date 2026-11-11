import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Next 16 proxy (formerly middleware). Clerk reads the session here so client
 * components know who is signed in. Phase 1 gates on the client, so no route is
 * protected yet. Without keys the proxy passes every request through.
 */
const enabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default enabled ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
