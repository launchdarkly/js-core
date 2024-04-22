#!/usr/bin/env bash

if [ -f "./$WORKSPACE_PATH/jsr.json" ]; then
  cd $WORKSPACE_PATH
  git diff HEAD
  if $LD_RELEASE_IS_DRYRUN ; then
    echo "Doing a dry run of jsr publishing."
    npx jsr publish --dry-run || { echo "jsr publish failed" >&2; exit 1; }
  elif [ -f "./$WORKSPACE_PATH/jsr.json" ]; then
    echo "Publishing to jsr."
    npx jsr publish || { echo "jsr publish failed" >&2; exit 1; }
  fi
else
  echo "Skipping jsr."
fi
