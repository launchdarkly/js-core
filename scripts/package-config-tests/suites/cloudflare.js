const fs = require('fs');
const path = require('path');

const { copyDir, install, run } = require('../lib');
const { check, startServer } = require('./edge');

const WRANGLER = '4.151.3';
const KV_KEY = 'LD-Env-test-client-side-id';

const WORKERS = {
  // TypeScript worker bundled by wrangler.
  sdk: 'src/sdk.ts',
  // OpenFeature provider.
  openfeature: 'src/of.ts',
  // Loads the SDK through CommonJS require.
  'cjs-require': 'src/cjs.js',
  // Prebuilt with tsup, as in packages/sdk/cloudflare/example.
  'tsup-prebuilt': 'dist/index.mjs',
};

// Runs Workers in workerd through `wrangler dev`, with flag data in local KV.
async function runSuite({ work, packs }) {
  const dir = path.join(work, 'cloudflare');
  fs.rmSync(dir, { recursive: true, force: true });
  copyDir(path.join(__dirname, '../fixtures/cloudflare'), dir);
  fs.copyFileSync(
    path.join(__dirname, '../fixtures/flag-data.json'),
    path.join(dir, 'flag-data.json'),
  );
  install(dir, packs, {
    type: 'module',
    launchdarkly: [
      '@launchdarkly/cloudflare-server-sdk',
      '@launchdarkly/openfeature-cloudflare-server',
    ],
    deps: {
      wrangler: WRANGLER,
      '@cloudflare/workers-types': '4.20260702.1',
      '@openfeature/server-sdk': '1.23.0',
      '@openfeature/core': '1.12.0',
      tsup: '8.5.1',
      typescript: '5.9.3',
    },
  });

  const results = {};
  const details = {};
  const tsup = run(path.join(dir, 'node_modules/.bin/tsup'), [], { cwd: dir });
  if (tsup.status !== 0) details['tsup-build'] = tsup.stdout + tsup.stderr;

  const wrangler = path.join(dir, 'node_modules/wrangler/bin/wrangler.js');
  const env = { WRANGLER_SEND_METRICS: 'false', CI: '1' };
  let port = 8790;
  for (const [name, main] of Object.entries(WORKERS)) {
    const config = `wrangler-${name}.toml`;
    fs.writeFileSync(
      path.join(dir, config),
      [
        `name = "ld-${name}"`,
        `main = "${main}"`,
        'compatibility_date = "2024-09-23"',
        'compatibility_flags = ["nodejs_compat"]',
        'kv_namespaces = [{ binding = "LD_KV", id = "ldkv", preview_id = "ldkv" }]',
        '',
      ].join('\n'),
    );
    const state = path.join(dir, `.state-${name}`);
    for (const preview of [[], ['--preview']]) {
      run(
        process.execPath,
        [
          wrangler,
          'kv',
          'key',
          'put',
          '--binding=LD_KV',
          KV_KEY,
          '--path',
          'flag-data.json',
          '--local',
          ...preview,
          '--persist-to',
          state,
          '-c',
          config,
        ],
        { cwd: dir, env: { ...process.env, ...env } },
      );
    }
    const key = `cloudflare | wrangler-${WRANGLER} | ${name}`;
    const dryRun = run(
      process.execPath,
      [wrangler, 'deploy', '--dry-run', '--outdir', `out-${name}`, '-c', config],
      { cwd: dir, env: { ...process.env, ...env } },
    );
    results[`${key} | deploy-dry-run`] = dryRun.status === 0 ? 'ok' : 'fail';
    if (dryRun.status !== 0) details[`${key} | deploy-dry-run`] = dryRun.stdout + dryRun.stderr;

    // eslint-disable-next-line no-await-in-loop
    const server = await startServer(
      process.execPath,
      [
        wrangler,
        'dev',
        '-c',
        config,
        '--port',
        String(port),
        '--ip',
        '127.0.0.1',
        '--persist-to',
        state,
        '--inspector-port',
        String(port + 100),
      ],
      { cwd: dir, env, url: `http://127.0.0.1:${port}/` },
    );
    // eslint-disable-next-line no-await-in-loop
    const outcome = server.failed
      ? { ok: false, detail: 'worker did not start' }
      : await check(`http://127.0.0.1:${port}/`);
    server.stop();
    results[`${key} | evaluate`] = outcome.ok ? 'ok' : 'fail';
    if (!outcome.ok)
      details[`${key} | evaluate`] = { response: outcome.detail, log: server.log().slice(-4000) };
    port += 1;
  }
  return { results, details };
}

module.exports = { run: runSuite };
