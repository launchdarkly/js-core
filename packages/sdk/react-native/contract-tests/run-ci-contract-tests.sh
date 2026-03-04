#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Set up port forwarding
adb reverse tcp:8001 tcp:8001
adb reverse tcp:8111 tcp:8111
adb reverse tcp:8112 tcp:8112

# Install and launch the APK
adb install "$REPO_ROOT/packages/sdk/react-native/contract-tests/entity/android/app/build/outputs/apk/release/app-release.apk"
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
    cat /tmp/adapter.log || true
    adb logcat -d -s ReactNativeJS:* | tail -100 || true
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
