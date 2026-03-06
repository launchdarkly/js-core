#!/bin/bash

trap 'kill 0' EXIT INT TERM

yarn workspace @launchdarkly/react-sdk-contract-tests run start:adapter &
ADAPTER_PID=$!

yarn workspace @launchdarkly/react-sdk-contract-tests run start:entity &

sleep 3

yarn workspace @launchdarkly/react-sdk-contract-tests run start:browser &

# Block here; adapter exits when test harness sends DELETE /
wait $ADAPTER_PID || true
