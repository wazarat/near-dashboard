#!/usr/bin/env bash
# Proves that `npm run rebuild` reproduces every generated output byte for byte from the committed raw files:
# clones HEAD into a temporary folder (so nothing uncommitted can leak in), installs, rebuilds, and compares the
# sha256 of every file in src/data/generated/ plus THESIS.md and README.md with a rebuild of this checkout.
#
#   npm run verify:rebuild
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/near-rebuild.XXXXXX")"
echo "fresh clone of $(git -C "$ROOT" rev-parse --short HEAD) in $WORK"
git clone --quiet --no-hardlinks "$ROOT" "$WORK/repo"

hashes() {
  (cd "$1" && find src/data/generated -type f | LC_ALL=C sort | xargs shasum -a 256 && shasum -a 256 THESIS.md README.md)
}

(cd "$WORK/repo" && npm ci --silent --no-audit --no-fund >/dev/null && npm run rebuild --silent >/dev/null)
(cd "$ROOT" && npm run rebuild --silent >/dev/null)

hashes "$WORK/repo" > "$WORK/clone.sha256"
hashes "$ROOT" > "$WORK/local.sha256"
# The committed THESIS.md and README.md must already equal what the rebuild writes.
(cd "$WORK/repo" && git diff --exit-code --stat -- THESIS.md README.md)

if diff -u "$WORK/local.sha256" "$WORK/clone.sha256"; then
  echo "byte-identical: $(wc -l < "$WORK/clone.sha256" | tr -d ' ') files ($WORK/clone.sha256)"
else
  echo "rebuild outputs differ between this checkout and a fresh clone" >&2
  exit 1
fi
