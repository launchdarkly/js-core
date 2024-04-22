#!/usr/bin/env bash

if [ -f "./$WORKSPACE_PATH/jsr.json" ]; then
  cd $WORKSPACE_PATH
  
  if $LD_RELEASE_IS_DRYRUN ; then
    echo "Doing a dry run of jsr publishing."
    npx jsr publish --dry-run --allow-dirty || { echo "jsr publish failed" >&2; exit 1; }
  elif [ -f "./$WORKSPACE_PATH/jsr.json" ]; then
    echo "Publishing to jsr."
    npx jsr publish --allow-dirty || { echo "jsr publish failed" >&2; exit 1; }
  fi
else
  echo "Skipping jsr."
fi
