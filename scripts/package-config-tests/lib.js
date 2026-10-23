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

// The repository's Yarn settings that the consumer projects reuse, so their dependencies go
// through the same minimum-age gate as the repository's own.
let yarnSettings;
function repoYarnSettings() {
  if (!yarnSettings) {
    const get = (key) => {
      const result = run('yarn', ['config', 'get', key, '--json'], { cwd: repoRoot });
      if (result.status !== 0) {
        throw new Error(`yarn config get ${key} failed:\n${result.stdout}\n${result.stderr}`);
      }
      return JSON.parse(result.stdout);
    };
    const { resolutions = {} } = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    );
    yarnSettings = {
      yarnPath: get('yarnPath'),
      rc: {
        enableImmutableInstalls: false,
        enableScripts: get('enableScripts'),
        nodeLinker: 'node-modules',
        npmMinimalAgeGate: get('npmMinimalAgeGate'),
        npmPreapprovedPackages: get('npmPreapprovedPackages'),
      },
      // jco (a dependency of the Fastly SDK) depends on a TypeScript version that Yarn's
      // built-in TypeScript patch cannot handle; the repository pins it, and so do we.
      resolutions: Object.fromEntries(
        Object.entries(resolutions).filter(([key]) => key.startsWith('@bytecodealliance/jco/')),
      ),
    };
  }
  return yarnSettings;
}

function packageDirs(nodeModules) {
  if (!fs.existsSync(nodeModules)) {
    return [];
  }
  return fs
    .readdirSync(nodeModules)
    .filter((name) => !name.startsWith('.'))
    .flatMap((name) =>
      name.startsWith('@')
        ? fs.readdirSync(path.join(nodeModules, name)).map((n) => path.join(nodeModules, name, n))
        : [path.join(nodeModules, name)],
    )
    .flatMap((dir) => [dir, ...packageDirs(path.join(dir, 'node_modules'))]);
}

// Required peer dependencies that no installed package can resolve, with the ranges asked for.
// Yarn, unlike npm, does not install these.
function missingPeers(dir) {
  const missing = {};
  for (const pkgDir of packageDirs(path.join(dir, 'node_modules'))) {
    const file = path.join(pkgDir, 'package.json');
    if (fs.existsSync(file)) {
      const { peerDependencies = {}, peerDependenciesMeta = {} } = JSON.parse(
        fs.readFileSync(file, 'utf8'),
      );
      for (const [name, range] of Object.entries(peerDependencies)) {
        let found = false;
        for (let d = path.dirname(pkgDir); !found && d.startsWith(dir); d = path.dirname(d)) {
          found = fs.existsSync(
            path.join(d, path.basename(d) === 'node_modules' ? '' : 'node_modules', name),
          );
        }
        if (!found && !peerDependenciesMeta[name]?.optional) {
          missing[name] = [...new Set([...(missing[name] ?? []), range])];
        }
      }
    }
  }
  return missing;
}

// One range for a peer that several packages ask for: the intersection when the ranges are simple,
// otherwise the first one.
function peerRange(ranges) {
  const specific = ranges.filter((r) => r !== '*').sort();
  if (!specific.length) {
    return '*';
  }
  return specific.some((r) => r.includes('||')) ? specific[0] : specific.join(' ');
}

// Installs the given dependencies with Yarn into a fresh project, using the repository's
// minimum-age gate. Every packed tarball is also a resolution, so packages depending on each
// other resolve to the local builds.
function install(dir, packs, { launchdarkly, deps = {}, type }) {
  const all = tarballs(packs);
  const selected = launchdarkly
    ? Object.fromEntries(launchdarkly.map((name) => [name, all[name]]))
    : all;
  const settings = repoYarnSettings();
  fs.mkdirSync(dir, { recursive: true });
  const pkg = {
    name: path.basename(dir),
    private: true,
    ...(type ? { type } : {}),
    dependencies: { ...selected, ...deps },
    resolutions: { ...settings.resolutions, ...all },
  };
  // JSON is valid YAML.
  fs.writeFileSync(path.join(dir, '.yarnrc.yml'), `${JSON.stringify(settings.rc, null, 2)}\n`);
  // Add missing required peers, as npm would, until there are none left.
  for (let attempt = 0; ; attempt += 1) {
    fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    // An empty lockfile makes this directory its own project, even inside another one.
    fs.writeFileSync(path.join(dir, 'yarn.lock'), '');
    const result = run(process.execPath, [settings.yarnPath, 'install'], {
      cwd: dir,
      env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '1' },
    });
    if (result.status !== 0) {
      throw new Error(`yarn install failed in ${dir}:\n${result.stdout}\n${result.stderr}`);
    }
    const missing = Object.entries(missingPeers(dir));
    if (!missing.length) {
      break;
    }
    if (attempt === 5) {
      throw new Error(`Peer dependencies still missing in ${dir}: ${missing.map(([n]) => n)}`);
    }
    for (const [name, ranges] of missing) {
      pkg.dependencies[name] = all[name] ?? peerRange(ranges);
    }
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
