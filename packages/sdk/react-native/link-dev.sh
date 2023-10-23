#!/bin/bash

echo "===== Installing all dependencies..."
yarn

declare -a examples=(example)

for example in "${examples[@]}"
do
  echo "===== Linking to $example"
  MODULES_DIR=$example/node_modules
  SDK_DIR=$MODULES_DIR/@launchdarkly/react-native-client-sdk
  COMMON_DIR="$SDK_DIR"/node_modules/@launchdarkly/js-sdk-common
  CLIENT_COMMON_DIR="$SDK_DIR"/node_modules/@launchdarkly/js-client-sdk-common

  mkdir -p "$MODULES_DIR"
  rm -rf "$SDK_DIR"
  mkdir -p "$COMMON_DIR"
  mkdir -p "$CLIENT_COMMON_DIR"

  rsync -aq package.json "$SDK_DIR"
  rsync -aq LICENSE "$SDK_DIR"
  rsync -aq node_modules "$SDK_DIR"
  rsync -aq src "$SDK_DIR"
  rsync -av dist "$SDK_DIR"

  rsync -aq ../../shared/common/ "$COMMON_DIR"
  rm -rf "$CLIENT_COMMON_DIR"
  rsync -aq ../../shared/sdk-client/ "$CLIENT_COMMON_DIR"
done
