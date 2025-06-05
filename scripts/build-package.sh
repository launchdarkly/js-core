#!/usr/bin/env bash

# Run this script like:
# ./scripts/build-package.sh

set -e

rm -rf dist

# Get name and version info from package.json
NAME=$(npm pkg get name --workspaces=false | tr -d \")
VERSION=$(npm pkg get version --workspaces=false | tr -d \")
pwd
# each build output folder cjs and esm needs a package.json with
# at least the correct type attribute set. We additionally set
# name and version because the SDK logic uses those for analytics.
CJS_PACKAGE_JSON="{
  \"name\": \"$NAME\",
  \"version\": \"$VERSION\",
  \"type\": \"commonjs\"
}"
ESM_PACKAGE_JSON="{
  \"name\": \"$NAME\",
  \"version\": \"$VERSION\",
  \"type\": \"module\"
}"

tsc --module commonjs --outDir dist/cjs/
echo "$CJS_PACKAGE_JSON" > dist/cjs/package.json

tsc --module es2022 --outDir dist/esm/
echo "$ESM_PACKAGE_JSON" > dist/esm/package.json
