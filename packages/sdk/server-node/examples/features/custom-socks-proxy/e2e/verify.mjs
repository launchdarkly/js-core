import { spawnSync } from 'node:child_process';

// This example prints "The <flagKey> feature flag evaluates to <flagValue>." on success. A
// successful run must contain that line. Proof that the SDK actually used the proxy (rather than
// connecting directly) is verified externally in CI by grepping the SOCKS proxy container's own
// logs; see .github/workflows/server-node.yml.
const EXPECTED_EVALUATION = 'feature flag evaluates to true';

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

console.log('\n*** e2e passed: SDK evaluated the flag through the SOCKS proxy.');
