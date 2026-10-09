import { ClientContext } from '@launchdarkly/js-sdk-common';

import { FileDataSourceFactory } from '../../src/integrations';
import Configuration from '../../src/options/Configuration';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';
import { createBasicPlatform } from '../createBasicPlatform';
import TestLogger from '../Logger';
import MockFilesystem from './filedata/MockFilesystem';

// The file data source chooses the parser by file extension only. A .yml or .yaml file uses the
// YAML parser, and every other file uses JSON.parse, whatever the content looks like.

const jsonDocument = '{"flagValues": {"flag1": "value1"}}';
const yamlDocument = 'flagValues:\n  flag1: value1\n';

describe('given a file data source over files with different extensions', () => {
  let filesystem: MockFilesystem;
  let featureStore: InMemoryFeatureStore;
  let asyncFeatureStore: AsyncStoreFacade;
  let errorHandler: jest.Mock;
  let yamlParser: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    featureStore = new InMemoryFeatureStore();
    asyncFeatureStore = new AsyncStoreFacade(featureStore);
    errorHandler = jest.fn();
    yamlParser = jest.fn(() => ({ flagValues: { flag1: 'from-yaml-parser' } }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const load = async (path: string, data: string, withYamlParser: boolean = true) => {
    filesystem.set(path, data);
    const factory = new FileDataSourceFactory({
      paths: [path],
      yamlParser: withYamlParser ? yamlParser : undefined,
    });
    const source = factory.create(
      new ClientContext('', new Configuration({ featureStore, logger: new TestLogger() }), {
        ...createBasicPlatform(),
        fileSystem: filesystem,
      }),
      featureStore,
      () => {},
      errorHandler,
    );
    source.start();
    await jest.runAllTimersAsync();
    source.close();
  };

  it('parses a file without a YAML extension as JSON and does not consult the YAML parser', async () => {
    await load('data.txt', jsonDocument);

    expect(await asyncFeatureStore.initialized()).toBe(true);
    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(flags.flag1.variations).toEqual(['value1']);
    expect(yamlParser).not.toHaveBeenCalled();
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it('reports a JSON error for a .json file with YAML content even when a YAML parser is configured', async () => {
    await load('data.json', yamlDocument);

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0].message).toMatch(/json/i);
    expect(yamlParser).not.toHaveBeenCalled();
    expect(await asyncFeatureStore.initialized()).toBe(false);
  });

  it.each(['yml', 'yaml'])(
    'parses a .%s file with the YAML parser even when its content looks like JSON',
    async (extension) => {
      await load(`data.${extension}`, jsonDocument);

      expect(yamlParser).toHaveBeenCalledWith(jsonDocument);
      const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
      expect(flags.flag1.variations).toEqual(['from-yaml-parser']);
      expect(errorHandler).not.toHaveBeenCalled();
    },
  );

  it.each(['yml', 'yaml'])(
    'reports the missing parser error for a .%s file whose content looks like JSON',
    async (extension) => {
      await load(`data.${extension}`, jsonDocument, false);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler.mock.calls[0][0].message).toEqual(
        `Attempted to parse yaml file (data.${extension}) without parser.`,
      );
      expect(await asyncFeatureStore.initialized()).toBe(false);
    },
  );

  it('accepts a document whose members are not objects keyed by key', async () => {
    await load('data.json', '{"flags": [], "flagValues": null, "segments": 0}');

    expect(errorHandler).not.toHaveBeenCalled();
    expect(await asyncFeatureStore.initialized()).toBe(true);
    expect(await asyncFeatureStore.all(VersionedDataKinds.Features)).toEqual({});
    expect(await asyncFeatureStore.all(VersionedDataKinds.Segments)).toEqual({});
  });

  it('stores a flag entry as written, without filling a missing key from the map key', async () => {
    await load('data.json', '{"flags": {"flag1": {"on": false, "version": 2}}}');

    expect(errorHandler).not.toHaveBeenCalled();
    const flags = await asyncFeatureStore.all(VersionedDataKinds.Features);
    expect(flags.flag1).toBeUndefined();
  });
});
