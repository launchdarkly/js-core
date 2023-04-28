# Run this script like:
# ./scripts/publish-doc.sh packages/sdk/node

set -e
set -x

# Get the script location so we can run adjacent scripts.
script_path=$(readlink -f "$0")
base_name=$(dirname "$script_path")
doc_name=$("$base_name"/doc-name.sh "$WORKSPACE")

# Move the built docs so switching branches doesn't conflict.
mv "$WORKSPACE"/docs "$RUNNER_TEMP"/doc-temp

# Action should have cloned the gh-pages to a subdirectory.
cd gh-pages

# When running on CI we need to configure github before we commit.
if [ -n "${CI:-}" ]; then
    git config --local user.email "github-actions[bot]@users.noreply.github.com"
    git config --local user.name "github-actions[bot]"
fi

# Grep returns a non-zero exit code for no matches, so we want to ingore it.
set +e
existing_doc=$(git ls-files | grep -c "$WORKSPACE"/docs)
set -e

if [ "$existing_doc" != "0" ]; then
    echo "There are existing docs; removing them."
    git rm -r "$WORKSPACE"/docs
    git commit -m "chore: Removed old docs for $WORKSPACE"
else
    echo "There are no existing docs; skipping removal."
fi

mkdir -p "$WORKSPACE"/docs

# Put the docs where they are expected for the github pages.
mv "$RUNNER_TEMP"/doc-temp/* "$WORKSPACE"/docs

git add "$WORKSPACE"/docs

git commit -m "chore: Updating docs for $doc_name"

# Update the local copy in case there have been any interim changes.
# If this works inconsistently, then additional checks should be done.


git config pull.rebase false  # merge

head_sha=""

set +e

while true
do
    
    git pull origin gh-pages --no-edit # should accept the default message
    after_pull_sha=$(git rev-parse HEAD)
    
    # The first time this runs the head_sha will be empty and they will not match.
    # If the push fails, then we pull again, and if the SHA does not change, then
    # the push will not succeed.
    if [ "$head_sha" == "$after_pull_sha" ]; then
        echo "Failed to get changes. Could not publish docs."
        exit 1
    fi
    
    head_sha=$after_pull_sha
    
    if git push; then
        break
    fi
    
    echo "Push failed, trying again."
done


set -e
