#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
if [ -z "$SDK_TEST_HARNESS_PATH" ]; then
  echo "ERROR: SDK_TEST_HARNESS_PATH is not set. Point it to your sdk-test-harness checkout."
  echo "  export SDK_TEST_HARNESS_PATH=/path/to/sdk-test-harness"
  exit 1
fi
TEST_HARNESS_PATH="$SDK_TEST_HARNESS_PATH"

echo "=== React Native Contract Tests ==="
echo "Repo root: $REPO_ROOT"
echo "Test harness: $TEST_HARNESS_PATH"

# Check prerequisites
if ! command -v adb &> /dev/null; then
  echo "ERROR: adb not found. Set ANDROID_HOME or install Android SDK."
  exit 1
fi

if ! adb devices | grep -q "device$"; then
  echo "ERROR: No Android device/emulator connected. Start an emulator first."
  exit 1
fi

# Set up adb reverse port forwarding
echo ""
echo "=== Setting up adb reverse ports ==="
adb reverse tcp:8001 tcp:8001   # WebSocket adapter
adb reverse tcp:8111 tcp:8111   # Test harness mock HTTP server
adb reverse tcp:8112 tcp:8112   # Test harness mock HTTPS server
echo "Port forwarding configured."

# Build the adapter
echo ""
echo "=== Building adapter ==="
cd "$REPO_ROOT"
yarn workspace react-native-contract-test-adapter run build

# Start the adapter in the background
echo ""
echo "=== Starting adapter ==="
yarn workspace react-native-contract-test-adapter run start > /tmp/rn-adapter.log 2>&1 &
ADAPTER_PID=$!
echo "Adapter started (PID: $ADAPTER_PID)"

# Wait for adapter to be ready
echo "Waiting for adapter on port 8001..."
for i in {1..30}; do
  if nc -z localhost 8001 2>/dev/null; then
    echo "Adapter WebSocket ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Timeout waiting for adapter."
    cat /tmp/rn-adapter.log
    kill $ADAPTER_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done

# Cleanup function
cleanup() {
  echo ""
  echo "=== Cleaning up ==="
  kill $ADAPTER_PID 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT

# Build and install the RN entity app
echo ""
echo "=== Building and installing RN entity app ==="
cd "$SCRIPT_DIR/entity"

if [ ! -d "android" ]; then
  echo "Running expo prebuild..."
  npx expo prebuild --platform android
fi

echo "Building release APK..."
cd android
./gradlew assembleRelease -q
cd ..

echo "Installing APK on device..."
adb install -r android/app/build/outputs/apk/release/app-release.apk

echo "Launching app..."
adb shell am start -n com.launchdarkly.rncontracttestentity/.MainActivity

# Wait for the app to connect
echo "Waiting for app to connect to WebSocket..."
sleep 10

# Verify the test service is responding
echo "Verifying test service..."
for i in {1..30}; do
  if curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "Test service is ready!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Timeout waiting for test service."
    echo "=== Adapter Log ==="
    cat /tmp/rn-adapter.log
    echo "=== Logcat ==="
    adb logcat -d -s ReactNativeJS:* 2>/dev/null | tail -50
    exit 1
  fi
  sleep 2
done

# Run the test harness
echo ""
echo "=== Running test harness ==="
cd "$TEST_HARNESS_PATH"

SUPPRESSIONS="$SCRIPT_DIR/suppressions.txt"
EXTRA_ARGS=""
if [ -s "$SUPPRESSIONS" ]; then
  EXTRA_ARGS="--skip-from=$SUPPRESSIONS"
fi

go run . \
  -url http://localhost:8000 \
  -debug \
  $EXTRA_ARGS \
  "$@"
