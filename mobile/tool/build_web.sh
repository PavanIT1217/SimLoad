#!/usr/bin/env bash
# Builds the SimLoad web app and copies it into assets/web for the mobile app.
# Run from anywhere:  mobile/tool/build_web.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(cd "$here/.." && pwd)"

cd "$root"
pnpm install --frozen-lockfile
# The app serves the build from the root of a local origin.
VITE_BASE=/ pnpm --filter @simload/web build

out="$here/assets/web"
rm -rf "$out"
mkdir -p "$out/assets"
# Source maps only add size; the service worker isn't used inside the app.
(cd "$root/apps/web/dist" && find . -type f ! -name '*.map' ! -name 'sw.js' -print0 | xargs -0 -I{} cp --parents {} "$out")

# pubspec.yaml lists asset folders one by one; fail loudly if Vite adds a new one.
extra="$(cd "$out" && find . -mindepth 1 -type d ! -path ./assets)"
if [ -n "$extra" ]; then
  echo "New folders in the web build, add them to pubspec.yaml under assets: $extra" >&2
  exit 1
fi
echo "Web build copied to $out"
