#!/usr/bin/env bash
# Run this script like:
# ./scripts/replace-version.sh packages/sdk/node

# It will look for the string __LD_VERSION__ in the `dist` directory and replace
# any instances with the version from the package.json.

# This is a workaround for a bug with the node-workspace plugin with release-please.
# https://github.com/googleapis/release-please/issues/1978

set -e

version=$(node -p "let pj = require('./$1/package.json');\`\${pj.version}\`");

find "$1/dist" -type f -exec sed -i.UNUSED_BAK "s/__LD_VERSION__/$version/g" {} +
find "$1/dist" -type f -name "*.UNUSED_BAK" -exec rm {} +
