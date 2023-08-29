# Run this script like:
# ./scripts/build-doc.sh packages/sdk/node

set -e


script_path=$(readlink -f "$0")
cd "$script_path"/..
npx typedoc --options "$1/typedoc.json"
