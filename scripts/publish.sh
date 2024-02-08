if $LD_RELEASE_IS_DRYRUN ; then
  # Dry run just pack the workspace.
  echo "Doing a dry run of publishing."
  yarn workspace $WORKSPACE pack
else
  if $LD_RELEASE_IS_PRERELEASE ; then
    echo "Publishing with prerelease tag."
    yarn workspace $WORKSPACE npm publish --tag prerelease || { echo "npm publish failed" >&2; exit 1; }
  else
    # Using a maintenance tag prevents this release from getting tagged with "latest".
    echo "Publishing with maintenance tag."
    yarn workspace $WORKSPACE npm publish --tag maintenance || { echo "npm publish failed" >&2; exit 1; }
  fi
fi
