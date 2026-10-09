import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { integrations } from '@launchdarkly/js-server-sdk-common';

import LDClientNode from '../src/LDClientNode';
import waitFor, { sleep } from './waitFor';

// These tests run on real files and real timers. The source waits for change notifications to
// settle for 100 ms and retries a failed load after one second.

const document = (value: string) => JSON.stringify({ flagValues: { flag: value } });

describe('given a file data source with automatic updates over a real directory', () => {
  let base: string;
  let directory: string;
  let filePath: string;
  let client: LDClientNode | undefined;

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'file-data-source-test-'));
    directory = path.join(base, 'data');
    filePath = path.join(directory, 'flags.json');
    fs.mkdirSync(directory);
  });

  afterEach(() => {
    client?.close();
    client = undefined;
    fs.rmSync(base, { recursive: true, force: true });
  });

  const start = async () => {
    const source = new integrations.FileDataSourceFactory({ paths: [filePath], autoUpdate: true });
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

  it('detects edits after the directory is deleted and created again', async () => {
    fs.writeFileSync(filePath, document('a'));
    await start();
    expect(await valueIs('a')()).toBe(true);

    fs.rmSync(directory, { recursive: true });
    await sleep(300);
    expect(await valueIs('a')()).toBe(true);

    // The directory comes back with the file. The retry or the new watch loads it.
    fs.mkdirSync(directory);
    fs.writeFileSync(filePath, document('b'));
    await waitFor(valueIs('b'));

    // Only a watch on the new directory can detect a later edit.
    fs.writeFileSync(filePath, document('c'));
    await waitFor(valueIs('c'), 3000);
  });
});
