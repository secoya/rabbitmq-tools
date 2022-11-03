#!/usr/bin/env bash

set -e
PKGROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && echo "$PWD")
PATH=$PKGROOT/node_modules/.bin:$PATH

main() {
  rm -rf "$PKGROOT/dist"
  tsc --project "$PKGROOT/tsconfig.build.json"
  eslint "$PKGROOT/src"
  esbuild-wrapper --tsconfig="$PKGROOT/tsconfig.build.json" "$PKGROOT/src/index.ts" "$PKGROOT/src/context.ts"
}

main "$@"
