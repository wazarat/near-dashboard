/** Fixture for the copy checker. Every string here follows the copy rules. */
export const LABEL = "Tracked for 2 of 13 projects";
export const URL = "https://example.org/path";
export const TIME = "12:30 UTC";
export const CLASSES = "md:flex lg:hidden";
export const SKIPPED = "Label: value"; // copy-ok

export function Clean() {
  return <p title={`Rows ${LABEL}`}>Showing every project, none filtered</p>;
}
