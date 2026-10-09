import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileOverrideSourceOptions } from '@launchdarkly/js-server-sdk-common';

import LDClientNode from '../src/LDClientNode';
import waitFor, { sleep } from './waitFor';

const user = { key: 'user-key' };

// The client never obtains data from LaunchDarkly: its only initializer reads a file that does
// not exist. Overrides are served from the override layer alone.
function makeClient(
  directory: string,
  overrides: Omit<FileOverrideSourceOptions, 'type'>,
): LDClientNode {
  return new LDClientNode('sdk-key-file-overrides', {
    sendEvents: false,
    diagnosticOptOut: true,
    logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
    dataSystem: {
      dataSource: {
        dataSourceOptionsType: 'custom',
        initializers: [{ type: 'file', paths: [join(directory, 'no-launchdarkly-data.json')] }],
        synchronizers: [],
      },
      overrides: { type: 'file', ...overrides },
    },
  });
}

const document = (value: string) => JSON.stringify({ flagValues: { 'overridden-flag': value } });

describe('given a temporary directory of override files', () => {
  let directory: string;
  let client: LDClientNode | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ld-file-overrides-'));
  });

  afterEach(async () => {
    client?.close();
    client = undefined;
    await rm(directory, { recursive: true, force: true });
  });

  it('reads a YAML file with the built-in parser', async () => {
    const path = join(directory, 'overrides.yaml');
    await writeFile(path, 'flagValues:\n  yaml-flag: "override-value"\n');
    client = makeClient(directory, { paths: [path] });

    // Evaluation does not wait for the initial load, so wait for the override to be in effect.
    await waitFor(
      async () =>
        (await client!.variationDetail('yaml-flag', user, 'default')).value === 'override-value',
      10000,
    );
    const detail = await client.variationDetail('yaml-flag', user, 'default');

    expect(detail.value).toEqual('override-value');
    expect(detail.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });
    expect(client.initialized()).toBe(false);
  });

  it('reloads a changed file in polling mode', async () => {
    const path = join(directory, 'overrides.json');
    await writeFile(path, document('b'));
    client = makeClient(directory, { paths: [path], changeDetection: 'polling', pollInterval: 1 });
    await waitFor(
      async () => (await client!.variation('overridden-flag', user, 'default')) === 'b',
      10000,
    );

    await writeFile(path, document('c'));

    await waitFor(
      async () => (await client!.variation('overridden-flag', user, 'default')) === 'c',
      10000,
    );
  });

  it('picks up a file that does not exist yet in watching mode', async () => {
    const path = join(directory, 'overrides.json');
    client = makeClient(directory, { paths: [path], changeDetection: 'watching' });
    const before = await client.variationDetail('overridden-flag', user, 'default');
    expect(before.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });

    await writeFile(path, document('b'));

    await waitFor(
      async () => (await client!.variation('overridden-flag', user, 'default')) === 'b',
      10000,
    );
  });

  it('removes the overrides of a deleted file', async () => {
    const path = join(directory, 'overrides.json');
    await writeFile(path, document('b'));
    client = makeClient(directory, { paths: [path] });
    await waitFor(
      async () => (await client!.variation('overridden-flag', user, 'default')) === 'b',
      10000,
    );

    await unlink(path);

    await waitFor(async () => {
      const detail = await client!.variationDetail('overridden-flag', user, 'default');
      return detail.reason.errorKind === 'CLIENT_NOT_READY';
    }, 10000);
  });

  it('keeps the last good overrides while the file is malformed', async () => {
    const path = join(directory, 'overrides.json');
    await writeFile(path, document('b'));
    client = makeClient(directory, { paths: [path] });
    await waitFor(
      async () => (await client!.variation('overridden-flag', user, 'default')) === 'b',
      10000,
    );

    await writeFile(path, '{"flagValues"');
    await sleep(1500);
    expect(await client.variation('overridden-flag', user, 'default')).toEqual('b');

    await writeFile(path, document('c'));

    await waitFor(
      async () => (await client!.variation('overridden-flag', user, 'default')) === 'c',
      10000,
    );
  });
});
