#!/bin/bash

# If sdk-test-harness is not in the path, then you will need to set
# the SDK_TEST_HARNESS environment variable to the path to the sdk-test-harness binary.

# Default to the local sdk-test-harness binary if not provided
if [ -z "${SDK_TEST_HARNESS}" ]; then
  SDK_TEST_HARNESS="sdk-test-harness"
fi

# Uncomment this to start the test service in the background
# yarn start &> test-service.log &

# skipping all tests that require streaming connections.
${SDK_TEST_HARNESS} --url http://localhost:8000 \
  --skip "streaming.*" \
  --skip "evaluation.*" \
  --skip "event.*" \
  --skip "service.*" \
  --stop-service-at-end
