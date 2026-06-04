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

# Run the FDv1 contract test harness
FDV1_SUPPRESSIONS="$SCRIPT_DIR/suppressions.txt"
FDV1_ARGS=""
if [ -s "$FDV1_SUPPRESSIONS" ]; then
  FDV1_ARGS="--skip-from=$FDV1_SUPPRESSIONS"
fi

echo "=== Running FDv1 contract tests ==="
"$REPO_ROOT/sdk-test-harness-v2" \
  -url http://localhost:8000 \
  -debug \
  $FDV1_ARGS

# Run the FDv2 contract test harness
FDV2_SUPPRESSIONS="$SCRIPT_DIR/suppressions-fdv2.txt"
FDV2_ARGS=""
if [ -s "$FDV2_SUPPRESSIONS" ]; then
  FDV2_ARGS="--skip-from=$FDV2_SUPPRESSIONS"
fi

echo "=== Running FDv2 contract tests ==="
"$REPO_ROOT/sdk-test-harness-v3" \
  -url http://localhost:8000 \
  -debug \
  $FDV2_ARGS
