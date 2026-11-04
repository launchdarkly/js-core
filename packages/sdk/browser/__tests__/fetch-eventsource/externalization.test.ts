import * as fs from 'node:fs';
import * as path from 'node:path';

// These tests read the built bundles. CI builds before it runs the tests. Run `yarn build` first
// when you run them locally.
function readBundle(fileName: string): string {
  const bundlePath = path.join(__dirname, '../../dist', fileName);
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`${bundlePath} does not exist. Build the package before you run this test.`);
  }
  return fs.readFileSync(bundlePath, 'utf8');
}

// tsup does not auto-externalize optionalDependencies. If the `external` entry in tsup.config.ts
// is removed, the transport is inlined and its underscore-prefixed members are mangled.
it('imports @launchdarkly/eventsource from the ESM fetch-eventsource bundle', () => {
  expect(readBundle('fetch-eventsource.js')).toMatch(/from\s*["']@launchdarkly\/eventsource["']/);
});

it('requires @launchdarkly/eventsource from the CJS fetch-eventsource bundle', () => {
  expect(readBundle('fetch-eventsource.cjs')).toMatch(
    /require\(\s*["']@launchdarkly\/eventsource["']\s*\)/,
  );
});

it('does not reference @launchdarkly/eventsource from the main bundle', () => {
  expect(readBundle('index.js')).not.toContain('@launchdarkly/eventsource');
});
