import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { integrations } from '@launchdarkly/js-server-sdk-common';

import LDClientNode from '../src/LDClientNode';
import waitFor from './waitFor';

// A configured path can be a symbolic link to a file in another directory. The directory that
// contains the link never reports a change to the target, so the source also watches the path
// itself, which follows the link. Symbolic links need privileges on Windows, so the test runs
// elsewhere.

const document = (value: string) => JSON.stringify({ flagValues: { flag: value } });

const itOnPosix = process.platform === 'win32' ? it.skip : it;

describe('given a file data source whose configured path links to a file elsewhere', () => {
  let base: string;
  let target: string;
  let link: string;
  let client: LDClientNode | undefined;

  const replaceTarget = (value: string) => {
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, document(value));
    fs.renameSync(temporary, target);
  };

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'file-data-source-symlink-'));
    fs.mkdirSync(path.join(base, 'real'));
    fs.mkdirSync(path.join(base, 'config'));
    target = path.join(base, 'real', 'flags.json');
    link = path.join(base, 'config', 'flags.json');
    fs.writeFileSync(target, document('a'));
    fs.symlinkSync(path.join('..', 'real', 'flags.json'), link);
  });

  afterEach(() => {
    client?.close();
    client = undefined;
    fs.rmSync(base, { recursive: true, force: true });
  });

  const start = async () => {
    const source = new integrations.FileDataSourceFactory({ paths: [link], autoUpdate: true });
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

  itOnPosix('detects edits and replacements of the target', async () => {
    await start();
    expect(await valueIs('a')()).toBe(true);

    // An in-place edit of the target.
    fs.writeFileSync(target, document('b'));
    await waitFor(valueIs('b'), 3000);

    // An atomic replacement of the target, twice: the direct watch is renewed after each.
    replaceTarget('c');
    await waitFor(valueIs('c'), 3000);
    replaceTarget('d');
    await waitFor(valueIs('d'), 3000);
  });
});
