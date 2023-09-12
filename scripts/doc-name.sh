# Given a path get the name for the documentation.
# ./scripts/doc-name.sh packages/sdk/server-node
# Produces something like:
# LaunchDarkly Server-Side SDK for Node.js (0.1.0)

set -e

node -p "let pj = require('./$1/package.json');\`\${pj.description} (\${pj.version})\`";
