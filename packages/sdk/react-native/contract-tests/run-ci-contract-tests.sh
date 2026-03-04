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

# Run the contract test harness
SUPPRESSIONS_FILE="$SCRIPT_DIR/suppressions.txt"
EXTRA_ARGS=""
if [ -s "$SUPPRESSIONS_FILE" ]; then
  EXTRA_ARGS="--skip-from=$SUPPRESSIONS_FILE"
fi

"$REPO_ROOT/sdk-test-harness" \
  -url http://localhost:8000 \
  -debug \
  $EXTRA_ARGS
