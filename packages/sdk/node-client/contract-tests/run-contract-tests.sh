#!/bin/sh
# Runs the SDK contract tests locally against a fresh build of @launchdarkly/node-client-sdk.
#
# Mirrors the GitHub Actions workflow at .github/workflows/node-client.yml: builds the SDK
# and its contract-test service, starts the service in the background, downloads the matching
# sdk-test-harness binary, and runs the harness against the service.
#
# Environment variables:
#   SUPPRESSIONS         Path to the suppressions file to pass via --skip-from. Defaults to
#                        ./testharness-suppressions.txt (next to this script). Use
#                        ./testharness-suppressions-fdv2.txt when running the harness from the
#                        feat/fdv2 branch.
#   TEST_HARNESS_PARAMS  Extra params appended to the harness command line.
#   VERSION              sdk-test-harness major version to download. Defaults to v2.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SUPPRESSIONS="${SUPPRESSIONS:-$SCRIPT_DIR/testharness-suppressions.txt}"
VERSION="${VERSION:-v2}"

yarn workspaces foreach -pR --topological-dev --from '@launchdarkly/node-client-sdk' run build
yarn workspace @launchdarkly/node-client-sdk-contract-tests build

yarn workspace @launchdarkly/node-client-sdk-contract-tests start &
SERVICE_PID=$!
trap 'kill $SERVICE_PID 2>/dev/null || true' EXIT

curl -s https://raw.githubusercontent.com/launchdarkly/sdk-test-harness/main/downloader/run.sh \
  | VERSION="$VERSION" \
    PARAMS="-url http://localhost:8000 -debug -stop-service-at-end --skip-from=$SUPPRESSIONS $TEST_HARNESS_PARAMS" \
    sh
