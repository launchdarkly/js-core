# Run this script like:
# ./scripts/build-doc.sh packages/sdk/node

# Get the script location so we can run adjacent scripts.
SCRIPT_PATH=$(readlink -f "$0")
BASE_NAME=$(dirname $SCRIPT_PATH)

# Determine the name to use for the doc. The name and version from package.json.
DOC_NAME=$($BASE_NAME/doc-name.sh $1)
npx typedoc --name "$DOC_NAME" --readme none --out ./$1/docs --entryPointStrategy packages $1;
