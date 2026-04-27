#!/usr/bin/env node

/**
 * Prints the workspace names of all released packages, one per line.
 * Released packages are those listed in .release-please-manifest.json.
 */

const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifest = require(path.join(repoRoot, '.release-please-manifest.json'));

for (const pkgPath of Object.keys(manifest)) {
  const { name } = require(path.join(repoRoot, pkgPath, 'package.json'));
  console.log(name);
}
