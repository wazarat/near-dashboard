import { SPECS } from "@/lib/query-specs";

/** Source labels used on every NEAR Intents chart so each point says where it comes from. */
export const EXPLORER_LABEL = "1Click swaps (Explorer API)";
export const LLAMA_LABEL = "NEAR Intents, all channels (DefiLlama)";

export const EXPLORER_COLOR = "var(--series-intents)";
export const LLAMA_COLOR = "var(--cat-2)";
export const SWAPS_COLOR = "var(--series-usage)";

export const EXPLORER_QUERY = SPECS.intentsExplorer;
export const LLAMA_QUERY = SPECS.intentsLlama;
export const TRANSFORM_QUERY = SPECS.intentsDaily;
