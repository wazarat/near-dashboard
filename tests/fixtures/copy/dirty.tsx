/** Fixture for the copy checker. Each string below breaks one rule. */
export const EM = "Projects — all of them";
export const COLON = "Result: partly supported";
export const TRAILING = "Sources:";

export function Dirty({ n }: { n: number }) {
  return <p title={`Count: ${n}`}>Shown: {n} rows</p>;
}
