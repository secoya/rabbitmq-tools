#!/usr/bin/env sh
# The github build action uses the official nodejs container does not have bash
# so this script must be POSIX sh compliant

set -e
PKGROOT=$(cd "$(dirname "$0")/.." && echo "$PWD")
PATH=$PKGROOT/node_modules/.bin:$PATH

main() {
  rm -rf "$PKGROOT/dist"
  mkdir "$PKGROOT/dist"
  prettier --check src
  esbuild-wrapper --no-bundle "$PKGROOT/src/context.ts"
  esbuild-wrapper "$PKGROOT/src/index.ts"
  eslint "$PKGROOT/src"
  tsc -p "$PKGROOT/tsconfig.build.json"
}

main "$@"
