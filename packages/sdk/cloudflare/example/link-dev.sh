#!/usr/bin/env bash

rm -rf node_modules/@launchdarkly
mkdir -p node_modules/@launchdarkly
rsync -aq ../dist node_modules/@launchdarkly/cloudflare-server-sdk
rsync -aq ../package.json node_modules/@launchdarkly/cloudflare-server-sdk
