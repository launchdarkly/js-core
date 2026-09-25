import { LDLogger } from '@launchdarkly/js-sdk-common';

import { FileOverrideSourceOptions } from '../src/api/options/LDDataSystemOptions';
import { LDOptions } from '../src/api/options/LDOptions';
import LDClientImpl from '../src/LDClientImpl';
import MockFilesystem from './data_sources/filedata/MockFilesystem';
import { makeCallbacks, makeFDv2Platform } from './overrides/overridesTestSupport';

const user = { key: 'user-key' };
const directory = '/etc/launchdarkly';
const jsonPath = `${directory}/overrides.json`;
const yamlPath = `${directory}/overrides.yaml`;

function makeLogger(): LDLogger {
  return { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs: number = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    if (await condition()) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }
  throw new Error('timed out waiting for the condition');
}

describe('given a client with a file override source over a mock filesystem', () => {
  let filesystem: MockFilesystem;
  let client: LDClientImpl | undefined;
  let platformYamlParser: jest.Mock;

  const makeClient = (
    overrides: Omit<FileOverrideSourceOptions, 'type'>,
    options: LDOptions = {},
  ) => {
    client = new LDClientImpl(
      'sdk-key-file-overrides',
      { ...makeFDv2Platform(), fileSystem: filesystem },
      {
        sendEvents: false,
        diagnosticOptOut: true,
        logger: makeLogger(),
        ...options,
        dataSystem: {
          dataSource: {
            dataSourceOptionsType: 'custom',
            initializers: [],
            synchronizers: [{ type: 'polling', pollInterval: 1000 }],
          },
          overrides: { type: 'file', changeDetection: 'watching', ...overrides },
        },
      },
      makeCallbacks(),
      { yamlParser: platformYamlParser },
    );
    return client;
  };

  beforeEach(() => {
    filesystem = new MockFilesystem();
    platformYamlParser = jest.fn(() => ({ flagValues: { 'yaml-flag': 'from-platform-parser' } }));
  });

  afterEach(() => {
    client?.close();
    client = undefined;
  });

  it('serves an override from a file that is present when the client is created', async () => {
    filesystem.set(jsonPath, '{"flagValues": {"overridden-flag": true}}');
    makeClient({ paths: [jsonPath] });

    const detail = await client!.boolVariationDetail('overridden-flag', user, false);

    expect(detail.value).toBe(true);
    expect(detail.reason).toEqual({ kind: 'OFF', overrideAffected: true });
    expect(client!.initialized()).toBe(false);
  });

  it('reads a YAML file with the parser the platform supplies', async () => {
    filesystem.set(yamlPath, 'flagValues:\n  yaml-flag: from-platform-parser\n');
    makeClient({ paths: [yamlPath] });

    const value = await client!.variation('yaml-flag', user, 'default');

    expect(value).toEqual('from-platform-parser');
    expect(platformYamlParser).toHaveBeenCalledWith(
      'flagValues:\n  yaml-flag: from-platform-parser\n',
    );
  });

  it('prefers a configured YAML parser over the one the platform supplies', async () => {
    const yamlParser = jest.fn(() => ({ flagValues: { 'yaml-flag': 'from-configured-parser' } }));
    filesystem.set(yamlPath, 'flagValues:\n  yaml-flag: x\n');
    makeClient({ paths: [yamlPath], yamlParser });

    expect(await client!.variation('yaml-flag', user, 'default')).toEqual('from-configured-parser');
    expect(platformYamlParser).not.toHaveBeenCalled();
  });

  it('reloads when the directory reports a change', async () => {
    filesystem.set(jsonPath, '{"flagValues": {"overridden-flag": "b"}}');
    makeClient({ paths: [jsonPath] });
    expect(await client!.variation('overridden-flag', user, 'default')).toEqual('b');

    filesystem.set(jsonPath, '{"flagValues": {"overridden-flag": "c"}}');
    filesystem.emit(directory);

    await waitFor(
      async () => (await client!.variation('overridden-flag', user, 'default')) === 'c',
    );
  });

  it('contributes no overrides for a file that does not exist until it appears', async () => {
    makeClient({ paths: [jsonPath] });

    const before = await client!.variationDetail('overridden-flag', user, 'default');
    expect(before.reason).toEqual({ kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' });

    filesystem.set(jsonPath, '{"flagValues": {"overridden-flag": "b"}}');
    filesystem.emit(directory, 'rename');

    await waitFor(
      async () => (await client!.variation('overridden-flag', user, 'default')) === 'b',
    );
  });

  it('fails client construction when no file paths are configured', () => {
    expect(() => makeClient({ paths: [] })).toThrow(
      'The file-based override source requires at least one file path',
    );
  });
});
