/**
 * Clerk's sign-in and sign-up in the CanHav look (docs/ATLAS-UI.md, section 1): dark ink
 * surfaces, Space Grotesk headings, Inter body, electric-500 as the only action colour.
 * Values reference the same CSS variables the site uses, so the light theme follows too.
 *
 * `pointer-events-auto` on the backdrop matters: Clerk's modal can open while one of the
 * site's own dialogs is still open (the login panel inside a project pop-up), and an open
 * Radix dialog sets `pointer-events: none` on the body, which Clerk's modal would inherit.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--electric-500)",
    colorBackground: "var(--ink-900)",
    colorInputBackground: "var(--ink-950)",
    colorText: "var(--ink-50)",
    colorTextSecondary: "var(--ink-300)",
    colorInputText: "var(--ink-50)",
    colorNeutral: "var(--ink-300)",
    colorDanger: "var(--rose-400)",
    colorSuccess: "var(--signal-400)",
    fontFamily: "var(--font-sans)",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "border border-ink-700/60 bg-ink-900 shadow-popover",
    headerTitle: "font-display text-ink-50",
    headerSubtitle: "text-ink-300",
    formButtonPrimary: "bg-electric-500 text-on-electric hover:bg-electric-400 normal-case",
    footerActionLink: "text-electric-300 hover:text-electric-200",
    socialButtonsBlockButton: "border-ink-700/60 text-ink-50 hover:bg-ink-800/60",
    modalBackdrop: "pointer-events-auto bg-ink-950/70 backdrop-blur-sm",
    userButtonPopoverCard: "border border-ink-700/60 bg-ink-900",
  },
} as const;
