/**
 * The login wall is on only when Clerk's keys are present (Vercel). Local runs and CI
 * without keys build and run with the wall off, and say so once.
 */
export const CLERK_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
export const AUTH_ENABLED = CLERK_PUBLISHABLE_KEY.length > 0;

let warned = false;
/** Server only (the secret key is never in the browser bundle). Called once from the root layout. */
export function warnIfAuthOff(): void {
  if (warned) return;
  const secret = (process.env.CLERK_SECRET_KEY ?? "").trim().length > 0;
  if (AUTH_ENABLED && secret) return;
  warned = true;
  if (AUTH_ENABLED !== secret) {
    // The provider reads the publishable key and the proxy needs both, so one key alone leaves the wall half on.
    console.warn("[atlas] Only one of NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY is set. Set both to turn the login wall on, or neither to keep it off.");
    return;
  }
  console.warn("[atlas] Clerk keys are not set, so the login wall is off. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to turn it on.");
}
