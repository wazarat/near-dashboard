/**
 * The login wall is on only when Clerk's keys are present (Vercel). Local runs and CI
 * without keys build and run with the wall off, and say so once.
 */
export const CLERK_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
export const AUTH_ENABLED = CLERK_PUBLISHABLE_KEY.length > 0;

/**
 * For the page checks only (`npm run e2e:wall`): with no Clerk key and NEXT_PUBLIC_WALL_PREVIEW=logged-out,
 * every reader is treated as logged out, so the wall can be checked without a Clerk account. It can only
 * close things, never open them, and the login buttons do nothing because there is no Clerk to open.
 */
export const WALL_PREVIEW = !AUTH_ENABLED && process.env.NEXT_PUBLIC_WALL_PREVIEW === "logged-out";

let warned = false;
/** Server only (the secret key is never in the browser bundle). Called once from the root layout. */
export function warnIfAuthOff(): void {
  if (warned) return;
  const secret = (process.env.CLERK_SECRET_KEY ?? "").trim().length > 0;
  if (AUTH_ENABLED && secret) return;
  warned = true;
  if (WALL_PREVIEW) {
    console.warn("[atlas] NEXT_PUBLIC_WALL_PREVIEW=logged-out, so every reader is treated as logged out and nobody can log in. This is for the page checks only.");
    return;
  }
  if (AUTH_ENABLED !== secret) {
    // The provider reads the publishable key and the proxy needs both, so one key alone leaves the wall half on.
    console.warn("[atlas] Only one of NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY is set. Set both to turn the login wall on, or neither to keep it off.");
    return;
  }
  console.warn("[atlas] Clerk keys are not set, so the login wall is off. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to turn it on.");
}
