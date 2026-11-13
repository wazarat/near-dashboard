import type { ThesisJson } from "./thesis-types";

export type Supported = ThesisJson["verdict"]["supported"];

/** The one place the thesis verdict gets its words, shared by the page badge and the onchain anchor record. */
export const VERDICT_LABEL: Record<Supported, string> = {
  yes: "Supported",
  partly: "Partly supported",
  no: "Not supported",
};
