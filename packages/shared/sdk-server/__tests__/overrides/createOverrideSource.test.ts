import { ClientContext, LDLogger } from '@launchdarkly/js-sdk-common';

import Configuration from '../../src/options/Configuration';
import { createOverrideSource, FileOverrideSource } from '../../src/overrides';
import { createBasicPlatform } from '../createBasicPlatform';
import MockFilesystem from '../data_sources/filedata/MockFilesystem';
import TestOverrideSource from './TestOverrideSource';

function makeLogger(): LDLogger & { warn: jest.Mock } {
  return { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
}

function makeContext(logger: LDLogger, withFilesystem: boolean = true): ClientContext {
  return new ClientContext('sdk-key', new Configuration({ logger }), {
    ...createBasicPlatform(),
    fileSystem: withFilesystem ? new MockFilesystem() : undefined,
  });
}

const defaultYamlParser = () => ({});

describe('given a client context with filesystem support', () => {
  let logger: ReturnType<typeof makeLogger>;
  let context: ClientContext;

  beforeEach(() => {
    logger = makeLogger();
    context = makeContext(logger);
  });

  it('creates a file source with polling once per second and fail handling by default', () => {
    const source = createOverrideSource(
      { type: 'file', paths: ['/a.json'] },
      context,
      defaultYamlParser,
    ) as FileOverrideSource;

    expect(source).toBeInstanceOf(FileOverrideSource);
    expect(source.config).toEqual({
      paths: ['/a.json'],
      duplicateKeysHandling: 'fail',
      changeDetection: 'polling',
      pollIntervalMs: 1000,
      yamlParser: defaultYamlParser,
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('applies the configured handling, mode, interval, and parser', () => {
    const yamlParser = () => ({ flags: {} });
    const source = createOverrideSource(
      {
        type: 'file',
        paths: ['/a.json', '/b.yaml'],
        duplicateKeysHandling: 'ignore',
        changeDetection: 'watching',
        pollInterval: 5,
        yamlParser,
      },
      context,
      defaultYamlParser,
    ) as FileOverrideSource;

    expect(source.config).toEqual({
      paths: ['/a.json', '/b.yaml'],
      duplicateKeysHandling: 'ignore',
      changeDetection: 'watching',
      pollIntervalMs: 5000,
      yamlParser,
    });
  });

  it('requires at least one file path', () => {
    expect(() => createOverrideSource({ type: 'file', paths: [] }, context)).toThrow(
      'The file-based override source requires at least one file path',
    );
    expect(() => createOverrideSource({ type: 'file', paths: [''] }, context)).toThrow(
      'The file-based override source requires at least one file path',
    );
    expect(() => createOverrideSource({ type: 'file' } as any, context)).toThrow(
      'The file-based override source requires at least one file path',
    );
    expect(() => createOverrideSource({ type: 'file', paths: 'a.json' as any }, context)).toThrow(
      'The file-based override source requires at least one file path',
    );
  });

  it('rejects an unrecognized change detection mode', () => {
    expect(() =>
      createOverrideSource(
        { type: 'file', paths: ['/a.json'], changeDetection: 'notify' as any },
        context,
      ),
    ).toThrow('Unrecognized change detection mode "notify" for the file-based override source');
  });

  it('warns and uses fail for an unrecognized duplicate keys handling', () => {
    const source = createOverrideSource(
      { type: 'file', paths: ['/a.json'], duplicateKeysHandling: 'bogus' as any },
      context,
    ) as FileOverrideSource;

    expect(source.config.duplicateKeysHandling).toEqual('fail');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('dataSystem.overrides.duplicateKeysHandling'),
    );
  });

  it('warns and raises a polling interval below the minimum', () => {
    const source = createOverrideSource(
      { type: 'file', paths: ['/a.json'], pollInterval: 0.1 },
      context,
    ) as FileOverrideSource;

    expect(source.config.pollIntervalMs).toEqual(1000);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('dataSystem.overrides.pollInterval'),
    );
  });

  it('warns and uses the default for a polling interval that is not a number', () => {
    const source = createOverrideSource(
      { type: 'file', paths: ['/a.json'], pollInterval: '5' as any },
      context,
    ) as FileOverrideSource;

    expect(source.config.pollIntervalMs).toEqual(1000);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('dataSystem.overrides.pollInterval'),
    );
  });

  it('warns and keeps the default parser for a YAML parser that is not a function', () => {
    const source = createOverrideSource(
      { type: 'file', paths: ['/a.json'], yamlParser: 'yaml' as any },
      context,
      defaultYamlParser,
    ) as FileOverrideSource;

    expect(source.config.yamlParser).toBe(defaultYamlParser);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('dataSystem.overrides.yamlParser'),
    );
  });

  it('returns a source object as is', () => {
    const source = new TestOverrideSource();
    expect(createOverrideSource(source, context)).toBe(source);
  });

  it('calls a factory with the client context', () => {
    const source = new TestOverrideSource();
    const factory = jest.fn(() => source);
    expect(createOverrideSource(factory, context)).toBe(source);
    expect(factory).toHaveBeenCalledWith(context);
  });

  it('rejects a configuration that is not a source', () => {
    expect(() => createOverrideSource({ type: 'other' } as any, context)).toThrow(
      'Unsupported override source configuration',
    );
    expect(() => createOverrideSource({ start: 'x' } as any, context)).toThrow(
      'Unsupported override source configuration',
    );
  });
});

it('rejects the file source on a platform without filesystem support', () => {
  const context = makeContext(makeLogger(), false);
  expect(() => createOverrideSource({ type: 'file', paths: ['/a.json'] }, context)).toThrow(
    'The file-based override source requires a platform with filesystem support',
  );
});
