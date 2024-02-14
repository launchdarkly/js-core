##!/bin/bash
#
#echo "===== Installing all dependencies..."
#yarn
#
#declare -a examples=(example)
#
#for example in "${examples[@]}"
#do
#  echo "===== Linking to $example"
#  MODULES_DIR="$example"/node_modules
#  SDK_DIR="$MODULES_DIR"/@launchdarkly/react-native-client-sdk
#  SDK_DIR_MODULES="$SDK_DIR"/node_modules
#  SDK_LD_DIR="$SDK_DIR_MODULES"/@launchdarkly
#  COMMON_DIR="$SDK_LD_DIR"/js-sdk-common
#  CLIENT_COMMON_DIR="$SDK_LD_DIR"/js-client-sdk-common
#
#  mkdir -p "$MODULES_DIR"
#  rm -rf "$SDK_DIR"
#  mkdir -p "$COMMON_DIR"
#  mkdir -p "$CLIENT_COMMON_DIR"
#
#  rsync -av dist "$SDK_DIR"
#  rsync -aq src "$SDK_DIR"
#  rsync -aq package.json "$SDK_DIR"
#  rsync -aq LICENSE "$SDK_DIR"
#  rsync -aq node_modules/@react-native-async-storage "$SDK_DIR"/node_modules
#  rsync -aq node_modules/base64-js "$SDK_DIR"/node_modules
#  rsync -aq node_modules/event-target-shim "$SDK_DIR"/node_modules
#
#  rsync -aq ../../shared/common/dist "$COMMON_DIR"
#  rsync -aq ../../shared/common/src "$COMMON_DIR"
#  rsync -aq ../../shared/common/package.json "$COMMON_DIR"
#
#  rm -rf "$CLIENT_COMMON_DIR"
#  rsync -aq ../../shared/sdk-client/dist "$CLIENT_COMMON_DIR"
#  rsync -aq ../../shared/sdk-client/src "$CLIENT_COMMON_DIR"
#  rsync -aq ../../shared/sdk-client/package.json "$CLIENT_COMMON_DIR"
#
#done
