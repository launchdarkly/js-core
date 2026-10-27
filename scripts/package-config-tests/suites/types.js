const fs = require('fs');
const path = require('path');

const { entrypoints, install, pool, runAsync } = require('../lib');

const TYPESCRIPT_VERSIONS = ['5.0.4', '5.9.3', '6.0.3'];

// Consumer compiler settings. The file extension controls whether the consumer is a
// CommonJS or an ES module under node16/nodenext.
const CONFIGS = {
  node10: { module: 'commonjs', moduleResolution: 'node10', ext: 'ts' },
  'node16-cjs': { module: 'node16', moduleResolution: 'node16', ext: 'cts' },
  'node16-esm': { module: 'node16', moduleResolution: 'node16', ext: 'mts' },
  'nodenext-cjs': { module: 'nodenext', moduleResolution: 'nodenext', ext: 'cts' },
  'nodenext-esm': { module: 'nodenext', moduleResolution: 'nodenext', ext: 'mts' },
  bundler: { module: 'esnext', moduleResolution: 'bundler', ext: 'ts' },
  preserve: { module: 'preserve', moduleResolution: 'bundler', ext: 'ts', minTs: [5, 4] },
};

function atLeast(version, [major, minor]) {
  const [a, b] = version.split('.').map(Number);
  return a > major || (a === major && b >= minor);
}

async function runSuite({ work, packs, variant }) {
  const versions = variant ? [variant] : TYPESCRIPT_VERSIONS;
  const dir = path.join(work, `types-${variant || 'all'}`);
  fs.rmSync(dir, { recursive: true, force: true });
  install(dir, packs, {
    deps: {
      ...Object.fromEntries(versions.map((v) => [`typescript-${v}`, `npm:typescript@${v}`])),
      '@types/node': '24.19.2',
      '@types/react': '19.3.0',
      react: '19.3.1',
      'react-dom': '19.3.1',
    },
  });

  const cases = [];
  for (const spec of entrypoints(dir)) {
    for (const [config, c] of Object.entries(CONFIGS)) {
      for (const version of versions) {
        if (!c.minTs || atLeast(version, c.minTs)) {
          const caseDir = path.join(
            dir,
            'cases',
            `${spec.replace(/[@/]/g, '_')}__${config}__${version}`,
          );
          fs.mkdirSync(caseDir, { recursive: true });
          fs.writeFileSync(
            path.join(caseDir, `index.${c.ext}`),
            `import * as m from '${spec}';\n\nexport const keys: string[] = Object.keys(m);\n`,
          );
          const compilerOptions = {
            module: c.module,
            moduleResolution: c.moduleResolution,
            target: 'es2022',
            lib: ['es2022', 'dom'],
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            esModuleInterop: true,
            types: ['node'],
            typeRoots: [path.join(dir, 'node_modules/@types')],
          };
          fs.writeFileSync(
            path.join(caseDir, 'tsconfig.json'),
            JSON.stringify({ compilerOptions, files: [`index.${c.ext}`] }),
          );
          cases.push({ key: `${spec} | ${config} | ts${version}`, caseDir, version });
        }
      }
    }
  }

  const results = {};
  const details = {};
  await pool(cases, Math.max(2, require('os').cpus().length), async ({ key, caseDir, version }) => {
    const tsc = path.join(dir, 'node_modules', `typescript-${version}`, 'bin', 'tsc');
    const { stdout } = await runAsync(process.execPath, [tsc, '-p', caseDir], { cwd: dir });
    const errors = stdout.split('\n').filter((line) => /error TS\d+/.test(line));
    const codes = [...new Set(errors.map((line) => line.match(/error (TS\d+)/)[1]))].sort();
    results[key] = codes.length ? codes.join(' ') : 'ok';
    if (errors.length)
      details[key] = errors.slice(0, 20).map((l) => l.replace(/^.*node_modules\//, ''));
  });

  return { results, details, inScope: (key) => versions.some((v) => key.endsWith(`| ts${v}`)) };
}

module.exports = { run: runSuite };
