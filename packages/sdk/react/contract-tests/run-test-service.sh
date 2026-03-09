#!/bin/bash

trap 'kill 0' EXIT INT TERM

yarn workspace @launchdarkly/react-sdk-contract-tests run start:adapter &
ADAPTER_PID=$!

yarn workspace @launchdarkly/react-sdk-contract-tests run start:entity &
ENTITY_PID=$!

sleep 3

yarn workspace @launchdarkly/react-sdk-contract-tests run start:browser &
BROWSER_PID=$!

# Block here; adapter exits when test harness sends DELETE /
wait $ADAPTER_PID || true

# Kill all remaining spawned processes
kill $ENTITY_PID $BROWSER_PID 2>/dev/null || true
