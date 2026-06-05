#!/bin/sh
# This script runs inside the android-emulator-runner action, where the
# emulator is alive. All adb commands must happen here — once this script
# exits the emulator is terminated.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Capture logs on any failure (while emulator is still alive)
dump_logs() {
  echo ""
  echo "=== Adapter Log ==="
  cat /tmp/adapter.log 2>/dev/null || echo "No adapter log"
  echo ""
  echo "=== Logcat (ReactNativeJS) ==="
  adb logcat -d -s ReactNativeJS:* 2>/dev/null | tail -200 || echo "No logcat available"
  echo ""
  echo "=== Logcat (recent errors) ==="
  adb logcat -d '*:E' 2>/dev/null | tail -50 || echo "No logcat available"
}
trap dump_logs EXIT

set -e

# Set up port forwarding
adb reverse tcp:8001 tcp:8001
adb reverse tcp:8111 tcp:8111
adb reverse tcp:8112 tcp:8112

# Install and launch the APK
APK_DIR="$REPO_ROOT/packages/sdk/react-native/contract-tests/entity/android/app/build/outputs/apk"
if [ -f "$APK_DIR/release/app-release.apk" ]; then
  adb install "$APK_DIR/release/app-release.apk"
elif [ -f "$APK_DIR/debug/app-debug.apk" ]; then
  adb install "$APK_DIR/debug/app-debug.apk"
else
  echo "ERROR: No APK found in $APK_DIR"
  ls -R "$APK_DIR" 2>/dev/null || true
  exit 1
fi
adb shell am start -n com.launchdarkly.rncontracttestentity/.MainActivity

# Wait for the app to connect to WebSocket
echo "Waiting for app to connect..."
i=0
while [ "$i" -lt 30 ]; do
  i=$((i + 1))
  if curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "Test service ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Timeout waiting for test service"
    exit 1
  fi
  sleep 2
done

# Fetch the official contract-test-harness runner once. This is the same
# downloader the launchdarkly/gh-actions contract-tests action uses; VERSION
# selects the harness release (v2 -> latest v2.x for FDv1, v3 -> latest v3.x
# for FDv2), and GITHUB_TOKEN (from the workflow env) avoids API rate limits.
# This mirrors the android-client-sdk contract-test setup.
HARNESS_RUNNER=/tmp/run-test-harness.sh
curl -sf \
  https://raw.githubusercontent.com/launchdarkly/sdk-test-harness/v2/downloader/run.sh \
  -o "$HARNESS_RUNNER"

# FDv1 (v2 harness).
FDV1_SUPPRESSIONS="$SCRIPT_DIR/suppressions.txt"
FDV1_SKIP=""
if [ -s "$FDV1_SUPPRESSIONS" ]; then
  FDV1_SKIP="--skip-from=$FDV1_SUPPRESSIONS"
fi

echo "=== Running FDv1 contract tests ==="
VERSION=v2 PARAMS="-url http://localhost:8000 -debug $FDV1_SKIP" sh "$HARNESS_RUNNER"

# FDv2 (v3 harness). Only the final run stops the test service.
FDV2_SUPPRESSIONS="$SCRIPT_DIR/suppressions-fdv2.txt"
FDV2_SKIP=""
if [ -s "$FDV2_SUPPRESSIONS" ]; then
  FDV2_SKIP="--skip-from=$FDV2_SUPPRESSIONS"
fi

echo "=== Running FDv2 contract tests ==="
VERSION=v3 PARAMS="-url http://localhost:8000 -debug $FDV2_SKIP -stop-service-at-end" sh "$HARNESS_RUNNER"
