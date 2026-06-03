import { spawnSync } from 'node:child_process';

// The Hello app prints "The <flagKey> feature flag evaluates to <flagValue>." on startup.
// The hello-world-demo boolean flag always returns true, so a successful run must contain this.
const EXPECTED = 'feature flag evaluates to true';

// Force one-shot mode so the continuously-running app exits after the initial evaluation.
const result = spawnSync('node', ['./dist/index.js'], {
  encoding: 'utf8',
  timeout: 60_000,
  env: { ...process.env, CI: '1' },
});

process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');

if (result.status !== 0) {
  console.error(`\n*** e2e failed: app exited with status ${result.status}.`);
  process.exit(1);
}

if (!(result.stdout ?? '').includes(EXPECTED)) {
  console.error(`\n*** e2e failed: expected output to contain "${EXPECTED}".`);
  process.exit(1);
}

console.log(`\n*** e2e passed: output contained "${EXPECTED}".`);
