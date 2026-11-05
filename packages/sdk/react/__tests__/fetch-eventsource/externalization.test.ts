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

// The React entry must import the browser SDK's entry and not bundle it. A bundled copy would
// require @launchdarkly/eventsource, which is not a dependency of this package.
it('imports the browser SDK entry from the ESM fetch-eventsource bundle', () => {
  const bundle = readBundle('fetch-eventsource.js');
  expect(bundle).toMatch(/from\s*["']@launchdarkly\/js-client-sdk\/fetch-eventsource["']/);
  expect(bundle).not.toContain('@launchdarkly/eventsource');
});

it('requires the browser SDK entry from the CJS fetch-eventsource bundle', () => {
  const bundle = readBundle('fetch-eventsource.cjs');
  expect(bundle).toMatch(
    /require\(\s*["']@launchdarkly\/js-client-sdk\/fetch-eventsource["']\s*\)/,
  );
  expect(bundle).not.toContain('@launchdarkly/eventsource');
});
