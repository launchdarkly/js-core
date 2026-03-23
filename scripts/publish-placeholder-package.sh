#!/bin/bash
# Publishes a placeholder package to npmjs so that OIDC trusted publishing
# can be configured. See contributing/publishing.md for details.
#
# Usage:
#   ./scripts/publish-placeholder-package.sh packages/type/my-package

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <workspace-path>"
  echo "Example: $0 packages/sdk/react"
  exit 1
fi

WORKSPACE_PATH="$1"

if [ ! -f "$WORKSPACE_PATH/package.json" ]; then
  echo "Error: $WORKSPACE_PATH/package.json not found"
  exit 1
fi

PACKAGE_NAME=$(./scripts/package-name.sh "$WORKSPACE_PATH")
echo "Publishing placeholder for: $PACKAGE_NAME"

# We must ensure that we are not publishing a placeholder to a package that already
# exists on npm.
if npm view "$PACKAGE_NAME" --json &>/dev/null; then
  echo "Package $PACKAGE_NAME already exists on npm. Skipping placeholder publish."
  exit 0
fi

TEMP_DIR=$(mktemp -d)

cleanup() {
  echo "Cleaning up temp directory..."
  rm -rf "$TEMP_DIR"
  echo "Logging out of npm..."
  npm logout 2>/dev/null || true
}
trap cleanup EXIT

echo "Logging in to npm..."
npm login

cat > "$TEMP_DIR/package.json" <<EOF
{
  "name": "$PACKAGE_NAME",
  "version": "0.0.0",
  "description": ""
}
EOF

echo "Publishing $PACKAGE_NAME@0.0.0 with tag 'snapshot'..."
npm publish --tag snapshot --access public "$TEMP_DIR"

echo ""
echo "Successfully published $PACKAGE_NAME@0.0.0"
echo ""
echo "Next steps:"
echo "  1. Configure trusted publishing on npmjs:"
echo "     https://docs.npmjs.com/trusted-publishers#configuring-trusted-publishing"
echo "  2. Mark the package as public on npmjs"
echo "  3. Continue with Step 1 in contributing/publishing.md"
