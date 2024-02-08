#!/bin/bash

echo "===== Installing all dependencies"
yarn

echo "===== Building native code"
yarn expo-prebuild

# HACK: This is needed to solve xcode build error:
# "[CP-User] [Hermes] Replace Hermes for the right configuration, if needed"
# https://github.com/facebook/react-native/issues/42112#issuecomment-1884536225
echo "===== Delete .xcode.env.local"
rm -rf ./ios/.xcode.env.local

echo "===== Start metro in background"
yarn start &

echo "===== Run ios tests"
yarn detox-ios

echo "===== Exit"
kill -9 $(lsof -t -i:8081)
