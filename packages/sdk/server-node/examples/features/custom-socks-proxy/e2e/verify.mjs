import { spawnSync } from 'node:child_process';

// This example prints "The <flagKey> feature flag evaluates to <flagValue>." on success, and
// (when no SOCKS_PROXY_URL is set) reports how many connections its bundled demo SOCKS proxy
// relayed. A successful run must contain both, proving the SDK actually used the proxy rather
// than connecting directly.
const EXPECTED_EVALUATION = 'feature flag evaluates to true';

// We should relay the identify and the evaluation
const EXPECTED_PROXY_USE = 'relayed 2 connection';

const result = spawnSync('node', ['./dist/index.js'], {
  encoding: 'utf8',
  timeout: 60_000,
  env: { ...process.env },
});

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

if (result.status !== 0) {
  console.error(`\n*** e2e failed: app exited with status ${result.status}.`);
  process.exit(1);
}

const output = result.stdout ?? '';
if (!output.includes(EXPECTED_EVALUATION)) {
  console.error(`\n*** e2e failed: expected output to contain "${EXPECTED_EVALUATION}".`);
  process.exit(1);
}
if (!output.includes(EXPECTED_PROXY_USE)) {
  console.error(`\n*** e2e failed: expected output to contain "${EXPECTED_PROXY_USE}".`);
  process.exit(1);
}

console.log('\n*** e2e passed: SDK traffic was relayed through the SOCKS proxy.');
