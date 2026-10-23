const fs = require('fs');
const path = require('path');

const { install, pool, runAsync, tarballs } = require('../lib');

// Runs "Are the types wrong?" on each packed package, for every entrypoint and resolution
// mode (node10, node16-cjs, node16-esm, bundler).
async function runSuite({ work, packs }) {
  const dir = path.join(work, 'attw');
  fs.rmSync(dir, { recursive: true, force: true });
  install(dir, packs, { launchdarkly: [], deps: { '@arethetypeswrong/cli': '0.18.5' } });
  const attw = path.join(dir, 'node_modules', '.bin', 'attw');

  const results = {};
  const details = {};
  await pool(Object.entries(tarballs(packs)), 4, async ([name, file]) => {
    const { stdout } = await runAsync(attw, [file.replace(/^file:/, ''), '--format', 'json'], {
      cwd: dir,
    });
    const { analysis } = JSON.parse(stdout);
    const problems = Array.isArray(analysis.problems)
      ? analysis.problems
      : Object.values(analysis.problems || {}).flat();
    for (const [entrypoint, info] of Object.entries(analysis.entrypoints)) {
      for (const resolutionKind of Object.keys(info.resolutions)) {
        const kinds = problems
          .filter(
            (p) =>
              (!p.entrypoint || p.entrypoint === entrypoint) &&
              (!p.resolutionKind || p.resolutionKind === resolutionKind),
          )
          .map((p) => p.kind);
        const key = `${name}${entrypoint.slice(1)} | ${resolutionKind}`;
        results[key] = kinds.length ? [...new Set(kinds)].sort().join(' ') : 'ok';
      }
    }
    if (problems.length) details[name] = problems;
  });
  return { results, details };
}

module.exports = { run: runSuite };
