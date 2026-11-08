let verbose = false;
export function setVerbose(v: boolean) {
  verbose = v;
}
export function log(msg: string) {
  console.log(msg);
}
export function debug(msg: string) {
  if (verbose) console.log(`  · ${msg}`);
}
export function warn(msg: string) {
  console.warn(`  ! ${msg}`);
}
