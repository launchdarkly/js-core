const fs = require('fs');
const path = require('path');

const { entrypoints, install, pool, runAsync } = require('../lib');

const EXTERNALS = [
  'react*',
  'electron',
  '@react-native*',
  'react-native*',
  'fastly:*',
  '@fastly/*',
];
const BUNDLES = [
  ['esm', 'node'],
  ['cjs', 'node'],
  ['esm', 'browser'],
  ['esm', 'neutral'],
];

// Loads each entrypoint with Node's require and import, and bundles it with esbuild for
// node, browser and neutral platforms.
async function runSuite({ work, packs }) {
  const dir = path.join(work, 'runtime');
  fs.rmSync(dir, { recursive: true, force: true });
  install(dir, packs, { deps: { esbuild: '0.25.10' } });
  const esbuild = path.join(dir, 'node_modules', '.bin', 'esbuild');

  const jobs = [];
  for (const spec of entrypoints(dir)) {
    jobs.push([`${spec} | require`, process.execPath, ['-e', `require('${spec}')`]]);
    jobs.push([
      `${spec} | import`,
      process.execPath,
      ['--input-type=module', '-e', `await import('${spec}')`],
    ]);
    for (const [format, platform] of BUNDLES) {
      const entry = path.join(dir, `entry-${spec.replace(/[@/]/g, '_')}.mjs`);
      fs.writeFileSync(entry, `import * as m from '${spec}';\nconsole.log(m);\n`);
      jobs.push([
        `${spec} | esbuild-${format}-${platform}`,
        esbuild,
        [
          entry,
          '--bundle',
          `--format=${format}`,
          `--platform=${platform}`,
          '--log-level=error',
          '--outfile=/dev/null',
          ...EXTERNALS.map((e) => `--external:${e}`),
        ],
      ]);
    }
  }

  const results = {};
  const details = {};
  await pool(jobs, 8, async ([key, cmd, args]) => {
    const { status, stderr } = await runAsync(cmd, args, { cwd: dir, timeout: 60000 });
    results[key] = status === 0 ? 'ok' : 'fail';
    if (status !== 0) details[key] = stderr.split('\n').filter(Boolean).slice(0, 6);
  });
  return { results, details };
}

module.exports = { run: runSuite };
