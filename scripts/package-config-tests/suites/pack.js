const fs = require('fs');
const path = require('path');

const { repoRoot, run } = require('../lib');

// Packs every released package (as listed in .release-please-manifest.json). The packages
// must already be built.
async function runSuite({ packs }) {
  fs.rmSync(packs, { recursive: true, force: true });
  fs.mkdirSync(packs, { recursive: true });
  const names = run('node', [path.join(repoRoot, 'scripts/released-packages.js')])
    .stdout.trim()
    .split('\n');
  for (const name of names) {
    const out = path.join(packs, `${name.replace('@launchdarkly/', '')}.tgz`);
    const result = run('yarn', ['workspace', name, 'pack', '--out', out], { cwd: repoRoot });
    if (result.status !== 0)
      throw new Error(`Packing ${name} failed:\n${result.stdout}${result.stderr}`);
  }
  console.log(`Packed ${names.length} packages into ${packs}`);
}

module.exports = { run: runSuite };
