import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { integrations } from '@launchdarkly/js-server-sdk-common';

import LDClientNode from '../src/LDClientNode';

// Kubernetes updates a mounted ConfigMap or Secret with an atomic symbolic link swap: the data
// lives in a timestamped directory, `..data` links to it, and each file in the mount is a link
// into `..data`. An update writes a new timestamped directory, links `..data_tmp` to it, and
// renames `..data_tmp` over `..data`. The configured file name never appears in an event.
// Symbolic links need privileges on Windows, so the test runs elsewhere.

const document = (value: string) => JSON.stringify({ flagValues: { flag: value } });

const settle = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function waitFor(condition: () => Promise<boolean>, timeoutMs: number = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    if (await condition()) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await settle(20);
  }
  throw new Error('timed out waiting for the condition');
}

const itOnPosix = process.platform === 'win32' ? it.skip : it;

describe('given a file data source with automatic updates over a ConfigMap-style mount', () => {
  let base: string;
  let mount: string;
  let client: LDClientNode | undefined;
  let version = 0;

  const writeVersion = (value: string) => {
    version += 1;
    const name = `..2026_${version}`;
    fs.mkdirSync(path.join(mount, name));
    fs.writeFileSync(path.join(mount, name, 'flags.json'), document(value));
    return name;
  };

  const swapTo = (name: string) => {
    const previous = fs.readlinkSync(path.join(mount, '..data'));
    fs.symlinkSync(name, path.join(mount, '..data_tmp'));
    fs.renameSync(path.join(mount, '..data_tmp'), path.join(mount, '..data'));
    fs.rmSync(path.join(mount, previous), { recursive: true });
  };

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'file-data-source-configmap-'));
    mount = path.join(base, 'config');
    fs.mkdirSync(mount);
    const first = writeVersion('a');
    fs.symlinkSync(first, path.join(mount, '..data'));
    fs.symlinkSync(path.join('..data', 'flags.json'), path.join(mount, 'flags.json'));
  });

  afterEach(() => {
    client?.close();
    client = undefined;
    fs.rmSync(base, { recursive: true, force: true });
  });

  const start = async () => {
    const source = new integrations.FileDataSourceFactory({
      paths: [path.join(mount, 'flags.json')],
      autoUpdate: true,
    });
    client = new LDClientNode('sdk-key', {
      updateProcessor: source.getFactory(),
      sendEvents: false,
    });
    client.on('error', () => {
      // A failed load is reported here. The tests observe the flag values instead.
    });
    await client.waitForInitialization({ timeout: 10 });
  };

  const valueIs = (value: string) => async () =>
    (await client!.variation('flag', { key: 'user' }, 'default')) === value;

  itOnPosix('detects each symbolic link swap', async () => {
    await start();
    expect(await valueIs('a')()).toBe(true);

    swapTo(writeVersion('b'));
    await waitFor(valueIs('b'), 3000);

    swapTo(writeVersion('c'));
    await waitFor(valueIs('c'), 3000);
  });
});
