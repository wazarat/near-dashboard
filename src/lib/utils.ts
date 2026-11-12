import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The design system's own text sizes (the --text-* tokens in globals.css). tailwind-merge only knows
 * Tailwind's built-in sizes, so without this it reads `text-label` as a colour and drops it beside
 * `text-ink-300`. Registered as font sizes, a size and a colour both survive, and two sizes still merge.
 */
export const CUSTOM_TEXT_SIZES = ["micro", "label", "body", "control", "card-title", "title", "stat"] as const;

const twMerge = extendTailwindMerge({ extend: { theme: { text: [...CUSTOM_TEXT_SIZES] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
