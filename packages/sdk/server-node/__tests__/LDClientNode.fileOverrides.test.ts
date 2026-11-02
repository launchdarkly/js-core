import { promises as fsPromises } from 'node:fs';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { FileOverrideSourceOptions, LDLogger, sleep } from '@launchdarkly/js-server-sdk-common';

import LDClientNode from '../src/LDClientNode';
import { rewriteInPlace, sampleValues } from './inPlaceWrites';
import waitFor from './waitFor';

const user = { key: 'user-key' };

const silentLogger: LDLogger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} };

// The client never obtains data from LaunchDarkly: its only initializer reads a file that does
// not exist. Overrides are served from the override layer alone.
function makeClient(
  directory: string,
  overrides: Omit<FileOverrideSourceOptions, 'type'>,
  logger: LDLogger = silentLogger,
): LDClientNode {
  return new LDClientNode('sdk-key-file-overrides', {
    sendEvents: false,
    diagnosticOptOut: true,
    logger,
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

  it('reads a YAML file with a configured parser', async () => {
    const path = join(directory, 'overrides.yaml');
    await writeFile(path, 'flagValues:\n  yaml-flag: "override-value"\n');
    client = makeClient(directory, { paths: [path], yamlParser: parseYaml });

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

  describe.each([
    ['json', 'watching'],
    ['json', 'polling'],
    ['yaml', 'watching'],
    ['yaml', 'polling'],
  ] as const)('given a %s file in %s mode', (extension, changeDetection) => {
    let polls: number[];

    beforeEach(() => {
      polls = [];
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // Records when the poller examines the file, so that a test can start a rewrite just before a
    // poll.
    const recordPolls = (path: string) => {
      const realStat = fsPromises.stat;
      jest.spyOn(fsPromises, 'stat').mockImplementation(((statPath: any, ...rest: any[]) => {
        if (statPath === path) {
          polls.push(Date.now());
        }
        return (realStat as any).call(fsPromises, statPath, ...rest);
      }) as any);
    };

    let path: string;
    let errors: string[];

    // Starts a client whose override file serves 'a'.
    const start = async () => {
      path = join(directory, `overrides.${extension}`);
      await writeFile(path, document('a')); // JSON is also YAML
      errors = [];
      recordPolls(path);
      client = makeClient(
        directory,
        { paths: [path], changeDetection, pollInterval: 1, yamlParser: parseYaml },
        { ...silentLogger, error: (message: string) => errors.push(message) },
      );
      await waitFor(
        async () => (await client!.variation('overridden-flag', user, 'default')) === 'a',
        10000,
      );
    };

    // Waits for the next poll and returns when it happened.
    const nextPoll = async () => {
      const count = polls.length;
      await waitFor(() => polls.length > count, 5000, 1);
      return polls[polls.length - 1];
    };

    // Samples what the client serves while the rewrites run, until it serves the final value.
    const sampleWhile = async (rewrite: () => Promise<void>, finalValue: string) => {
      const sampler = sampleValues(() => client!.variation('overridden-flag', user, 'default'));
      try {
        await rewrite();
        // Waits for the sampler itself to see the final value, so it has recorded everything that
        // the client served before it.
        await waitFor(() => sampler.served.includes(finalValue), 10000);
      } finally {
        await sampler.stop();
      }
      return sampler.served;
    };

    const loadFailures = () =>
      errors.filter((message) => message.startsWith('Unable to load flags'));

    it('keeps the override while the file is rewritten in place', async () => {
      await start();
      let pauseMs = 300;
      if (changeDetection === 'polling') {
        // The rewrite starts 750 ms after a poll, so the next poll finds the file empty, and its
        // reload 100 ms later still does. The file is written 250 ms after that, well before the
        // retry reads it again a second after the reload.
        await sleep((await nextPoll()) + 750 - Date.now());
        pauseMs = 600;
      }
      // In watching mode, the reload that the truncation starts runs after the 100 ms settle
      // window, while the file is still empty.
      const served = await sampleWhile(() => rewriteInPlace(path, document('b'), pauseMs), 'b');

      expect(served).toEqual(['a', 'b']);
      expect(loadFailures()).toEqual([]);
    });

    it('keeps the override through two in-place rewrites in a row', async () => {
      await start();
      let rewrites: () => Promise<void>;
      if (changeDetection === 'polling') {
        // The first rewrite starts 750 ms after a poll, so the next poll finds the file empty.
        // The second starts 1900 ms after that poll, before the next poll and the retry, so they
        // find the file empty again before any load has read the first rewrite's content.
        const poll = await nextPoll();
        await sleep(poll + 750 - Date.now());
        rewrites = async () => {
          await rewriteInPlace(path, document('b'), 600);
          await sleep(poll + 1900 - Date.now());
          await rewriteInPlace(path, document('c'), 600);
        };
      } else {
        // The first rewrite's write and the second's truncation fall in one settle window, so the
        // load after them finds the file empty again.
        rewrites = async () => {
          await rewriteInPlace(path, document('b'), 300);
          await sleep(20);
          await rewriteInPlace(path, document('c'), 300);
        };
      }
      const served = await sampleWhile(rewrites, 'c');

      expect(served).not.toContain('default');
      expect(served[0]).toEqual('a');
      expect(served[served.length - 1]).toEqual('c');
      expect(loadFailures()).toEqual([]);
    });
  });
});
