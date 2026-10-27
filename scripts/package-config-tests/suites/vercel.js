const fs = require('fs');
const http = require('http');
const path = require('path');

const { copyDir, install, run } = require('../lib');
const { check, startServer } = require('./edge');

const NEXT = '16.4.2';

// Serves the Edge Config item API that @vercel/edge-config calls for an "external"
// connection string, so the SDK reads its flag data through the real client.
function startEdgeConfigMock(data) {
  const server = http.createServer((req, res) => {
    if (
      new URL(req.url, 'http://localhost').pathname === '/ecfg_test/item/LD-Env-test-client-side-id'
    ) {
      res.writeHead(200, { 'content-type': 'application/json', etag: '"1"' });
      res.end(data);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Builds a Next.js app with an edge route handler and edge middleware, using Turbopack and
// webpack, and serves it with `next start`.
async function runSuite({ work, packs }) {
  const dir = path.join(work, 'vercel');
  fs.rmSync(dir, { recursive: true, force: true });
  copyDir(path.join(__dirname, '../fixtures/vercel'), dir);
  install(dir, packs, {
    launchdarkly: ['@launchdarkly/vercel-server-sdk'],
    deps: {
      next: NEXT,
      react: '19.1.10',
      'react-dom': '19.1.10',
      '@vercel/edge-config': '1.5.1',
      typescript: '5.9.3',
      '@types/react': '19.3.0',
      '@types/node': '24.19.2',
    },
  });

  const mock = await startEdgeConfigMock(
    fs.readFileSync(path.join(__dirname, '../fixtures/flag-data.json')),
  );
  const env = {
    EDGE_CONFIG: `http://127.0.0.1:${mock.address().port}/ecfg_test?token=test`,
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const next = path.join(dir, 'node_modules/next/dist/bin/next');
  const results = {};
  const details = {};
  let port = 3100;
  try {
    for (const bundler of ['turbopack', 'webpack']) {
      const key = `vercel | next-${NEXT}-${bundler}`;
      fs.rmSync(path.join(dir, '.next'), { recursive: true, force: true });
      const build = run(
        process.execPath,
        [next, 'build', ...(bundler === 'webpack' ? ['--webpack'] : [])],
        { cwd: dir, env: { ...process.env, ...env } },
      );
      results[`${key} | build`] = build.status === 0 ? 'ok' : 'fail';
      if (build.status !== 0) {
        details[`${key} | build`] = (build.stdout + build.stderr).slice(-6000);
      } else {
        // eslint-disable-next-line no-await-in-loop
        const server = await startServer(process.execPath, [next, 'start', '-p', String(port)], {
          cwd: dir,
          env,
          url: `http://127.0.0.1:${port}/`,
        });
        for (const [route, url] of [
          ['edge-route', '/api/flag'],
          ['middleware', '/mw'],
        ]) {
          // eslint-disable-next-line no-await-in-loop
          const outcome = server.failed
            ? { ok: false, detail: 'server did not start' }
            : await check(`http://127.0.0.1:${port}${url}`);
          results[`${key} | ${route}`] = outcome.ok ? 'ok' : 'fail';
          if (!outcome.ok)
            details[`${key} | ${route}`] = {
              response: outcome.detail,
              log: server.log().slice(-4000),
            };
        }
        server.stop();
      }
      port += 1;
    }
  } finally {
    mock.close();
  }
  return { results, details };
}

module.exports = { run: runSuite };
