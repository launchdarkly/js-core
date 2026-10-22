const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

function run(cmd, args, opts = {}) {
  return cp.spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
}

function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    cp.execFile(
      cmd,
      args,
      { encoding: 'utf8', maxBuffer: 1 << 28, ...opts },
      (error, stdout, stderr) => resolve({ status: error ? (error.code ?? 1) : 0, stdout, stderr }),
    );
  });
}

async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const item = items[next];
        next += 1;
        // eslint-disable-next-line no-await-in-loop
        await fn(item);
      }
    }),
  );
}

function tarballs(packs) {
  const deps = {};
  for (const file of fs.readdirSync(packs).filter((f) => f.endsWith('.tgz'))) {
    deps[`@launchdarkly/${file.replace(/\.tgz$/, '')}`] = `file:${path.join(packs, file)}`;
  }
  if (!Object.keys(deps).length) {
    throw new Error(`No package tarballs in ${packs}; run the "pack" suite first.`);
  }
  return deps;
}

// Installs the given dependencies with npm into a fresh project. Every packed tarball is
// also an override, so packages depending on each other resolve to the local builds.
function install(dir, packs, { launchdarkly, deps = {}, type, extraArgs = [] }) {
  const all = tarballs(packs);
  const selected = launchdarkly
    ? Object.fromEntries(launchdarkly.map((name) => [name, all[name]]))
    : all;
  fs.mkdirSync(dir, { recursive: true });
  const pkg = {
    name: path.basename(dir),
    private: true,
    ...(type ? { type } : {}),
    dependencies: { ...selected, ...deps },
    overrides: all,
  };
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  const result = run('npm', ['install', '--no-audit', '--no-fund', ...extraArgs], {
    cwd: dir,
    env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '1' },
  });
  if (result.status !== 0) {
    throw new Error(`npm install failed in ${dir}:\n${result.stdout}\n${result.stderr}`);
  }
}

// Every public entrypoint of every installed @launchdarkly package, as import specifiers.
function entrypoints(dir) {
  const scope = path.join(dir, 'node_modules', '@launchdarkly');
  const specs = [];
  for (const name of fs.readdirSync(scope).sort()) {
    const pkg = JSON.parse(fs.readFileSync(path.join(scope, name, 'package.json'), 'utf8'));
    const subpaths =
      pkg.exports && typeof pkg.exports === 'object'
        ? Object.keys(pkg.exports).filter((k) => k.startsWith('.') && !k.endsWith('package.json'))
        : [];
    for (const subpath of subpaths.length ? subpaths : ['.']) {
      specs.push(pkg.name + subpath.slice(1));
    }
  }
  return specs;
}

function copyDir(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

module.exports = { repoRoot, run, runAsync, pool, install, entrypoints, copyDir, tarballs };
