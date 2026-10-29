const fs = require('fs');
const path = require('path');

const { entrypoints, install, pool, runAsync } = require('../lib');

const TYPESCRIPT_VERSIONS = ['5.0.4', '5.9.3', '6.0.3'];

// The `tlsParams` regression cases compile a `Buffer` assignment with an @types/node version
// whose last `BufferConstructor` construct signature returns `Buffer<ArrayBuffer>`. A bad
// `GlobalBuffer` inference then rejects `fs.readFileSync(...)` under TS 5.9 and later.
const TLS_TYPES_NODE = '22.13.6';
const TLS_MIN_TS = [5, 9];
const TLS_CONSUMERS = ['@launchdarkly/js-server-sdk-common', '@launchdarkly/node-server-sdk'];

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
          cases.push({ key: `${spec} | ${config} | ts${version}`, dir, caseDir, version });
        }
      }
    }
  }

  const tlsVersions = versions.filter((version) => atLeast(version, TLS_MIN_TS));
  if (tlsVersions.length) {
    const tlsDir = path.join(work, `types-tls-${variant || 'all'}`);
    fs.rmSync(tlsDir, { recursive: true, force: true });
    install(tlsDir, packs, {
      launchdarkly: TLS_CONSUMERS,
      deps: {
        ...Object.fromEntries(tlsVersions.map((v) => [`typescript-${v}`, `npm:typescript@${v}`])),
        '@types/node': TLS_TYPES_NODE,
      },
    });
    for (const spec of TLS_CONSUMERS) {
      for (const version of tlsVersions) {
        const caseDir = path.join(
          tlsDir,
          'cases',
          `${spec.replace(/[@/]/g, '_')}__tls__${version}`,
        );
        fs.mkdirSync(caseDir, { recursive: true });
        fs.writeFileSync(
          path.join(caseDir, 'index.cts'),
          `import * as fs from 'fs';\nimport type { LDOptions } from '${spec}';\n\nexport const options: LDOptions = {\n  tlsParams: { ca: fs.readFileSync('ca.pem') },\n};\n\n// The rejection proves the option type did not collapse to \`any\`.\nexport const rejected: LDOptions = {\n  // @ts-expect-error a number is not a valid certificate value\n  tlsParams: { ca: 42 },\n};\n`,
        );
        const compilerOptions = {
          module: 'node16',
          moduleResolution: 'node16',
          target: 'es2022',
          lib: ['es2022'],
          strict: true,
          noEmit: true,
          // The case checks the published option types, not the @types/node internals.
          skipLibCheck: true,
          esModuleInterop: true,
          types: ['node'],
          typeRoots: [path.join(tlsDir, 'node_modules/@types')],
        };
        fs.writeFileSync(
          path.join(caseDir, 'tsconfig.json'),
          JSON.stringify({ compilerOptions, files: ['index.cts'] }),
        );
        cases.push({ key: `${spec} | tls | ts${version}`, dir: tlsDir, caseDir, version });
      }
    }
  }

  const results = {};
  const details = {};
  await pool(
    cases,
    Math.max(2, require('os').cpus().length),
    async ({ key, dir: caseRoot, caseDir, version }) => {
      const tsc = path.join(caseRoot, 'node_modules', `typescript-${version}`, 'bin', 'tsc');
      const { stdout } = await runAsync(process.execPath, [tsc, '-p', caseDir], { cwd: caseRoot });
      const errors = stdout.split('\n').filter((line) => /error TS\d+/.test(line));
      const codes = [...new Set(errors.map((line) => line.match(/error (TS\d+)/)[1]))].sort();
      results[key] = codes.length ? codes.join(' ') : 'ok';
      if (errors.length)
        details[key] = errors.slice(0, 20).map((l) => l.replace(/^.*node_modules\//, ''));
    },
  );

  return { results, details, inScope: (key) => versions.some((v) => key.endsWith(`| ts${v}`)) };
}

module.exports = { run: runSuite };
