#!/bin/bash

# Run this script like:
# ./scripts/build-doc.sh packages/sdk/node

set -e

# Get the script location so we can run adjacent scripts.
script_path=$(readlink -f "$0")
base_name=$(dirname $script_path)

# Determine the name to use for the doc. The name and version from package.json.
doc_name=$($base_name/doc-name.sh $1)
npx typedoc --name "$doc_name" --readme none --out ./$1/docs --entryPointStrategy packages $1;
