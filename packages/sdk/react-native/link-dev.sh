#!/bin/bash

echo "===== Installing all dependencies..."
yarn

declare -a examples=(example)

for example in "${examples[@]}"
do
  echo "===== Linking to $example"
  MODULES_DIR=$example/node_modules
  SDK_DIR=$MODULES_DIR/@launchdarkly/react-native-client-sdk

  mkdir -p "$MODULES_DIR"
  rm -rf "$SDK_DIR"
  mkdir -p "$SDK_DIR"/node_modules

  rsync -aq package.json "$SDK_DIR"
  rsync -aq LICENSE "$SDK_DIR"
  rsync -aq node_modules "$SDK_DIR"
  rsync -av src "$SDK_DIR"
  rsync -av dist "$SDK_DIR"
done
