import {
  FileReloader,
  FileReloaderConfig,
  hasContent,
  LoadFailure,
  ReloadResult,
} from '../../../src/data_sources/filedata';
import { parseOverrideDocument } from '../../../src/overrides/overrideDocument';
import TestLogger, { LogLevel } from '../../Logger';
import MockFilesystem from './MockFilesystem';
import testPolicy from './testPolicy';

// These tests rewrite a file the way an application or editor rewrites it in place: the file is
// truncated, and the new content is written some time later. A reload in between finds the file
// empty.

const jsonPath = '/data/data.json';
const yamlPath = '/data/data.yaml';
const otherYamlPath = '/data/other.yaml';
const retryDelayMs = 1000;

const documentA = '{"flagValues": {"flag1": "a"}}';
const documentB = '{"flagValues": {"flag1": "b"}}';

// A stand-in for a YAML parser. A flow-style document like the ones above is both JSON and YAML,
// and like the YAML parsers, it returns null for a file with no content.
const yamlParser = (data: string) => (hasContent(data) ? JSON.parse(data) : null);

const emptiedReadAgain = /is empty, possibly while it is being rewritten; reading it again/;

describe('given a reloader over a file that is rewritten in place', () => {
  let filesystem: MockFilesystem;
  let logger: TestLogger;
  let applied: ReloadResult[];
  let failures: LoadFailure[];
  let reloader: FileReloader;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    logger = new TestLogger();
    applied = [];
    failures = [];
  });

  afterEach(() => {
    reloader?.close();
    jest.useRealTimers();
  });

  // The policy parses by extension and validates the document as the override source does, so a
  // YAML file with no content is a document with no entries and a JSON file with no content fails.
  const makeReloader = (paths: string[], configure?: (config: FileReloaderConfig) => void) => {
    const config: FileReloaderConfig = {
      paths,
      policy: testPolicy({ parseDocument: parseOverrideDocument(yamlParser) }),
      filesystem,
      logger,
      apply: (result) => applied.push(result),
      onFailure: (failure) => failures.push(failure),
      debounceDelayMs: 0,
      retryDelayMs,
      skipUnchanged: true,
    };
    configure?.(config);
    reloader = new FileReloader(config);
    return reloader;
  };

  const readAgainMessages = () =>
    logger.getMessages(LogLevel.Debug).filter((message) => emptiedReadAgain.test(message));

  const values = () =>
    applied.map((result) => result.flags.map(({ item }) => item.variations?.[0]).join(','));

  const changeAndSettle = async () => {
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
  };

  it.each(['', ' \n\t\r\n', '\uFEFF'])(
    'reads an emptied file again and applies the rewritten content with no empty application, for content %j',
    async (empty) => {
      filesystem.set(yamlPath, documentA);
      makeReloader([yamlPath]);
      await reloader.reloadNow();

      filesystem.set(yamlPath, empty);
      await changeAndSettle();
      expect(values()).toEqual(['a']);
      expect(failures).toEqual([]);
      logger.expectMessages([{ level: LogLevel.Debug, matches: emptiedReadAgain }]);

      filesystem.set(yamlPath, documentB);
      await changeAndSettle();
      expect(values()).toEqual(['a', 'b']);
      expect(failures).toEqual([]);
    },
  );

  it('applies a YAML file that stays empty when the retry reads it again', async () => {
    filesystem.set(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    filesystem.set(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    await jest.advanceTimersByTimeAsync(retryDelayMs - 1);
    expect(values()).toEqual(['a']);
    await jest.advanceTimersByTimeAsync(1);
    expect(values()).toEqual(['a', '']);
    expect(failures).toEqual([]);
  });

  it('does not report an emptied JSON file at the load that finds it empty, and the retry reports it', async () => {
    filesystem.set(jsonPath, documentA);
    makeReloader([jsonPath]);
    await reloader.reloadNow();

    filesystem.set(jsonPath, '');
    await changeAndSettle();
    expect(failures).toEqual([]);

    await jest.advanceTimersByTimeAsync(retryDelayMs);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ kind: 'parse', path: jsonPath, repeated: false });
    expect(failures[0].error.message).toEqual(
      'the file has no content, which is not a JSON document',
    );
    expect(values()).toEqual(['a']);
  });

  it('applies a file that stays empty at the next change signal, before the retry would', async () => {
    filesystem.set(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    filesystem.set(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    // A stream of change signals cannot hold the data back: the file was empty at its last read.
    await changeAndSettle();
    expect(values()).toEqual(['a', '']);
  });

  it('never reads an empty placeholder file again, and it does not delay a change to another file', async () => {
    filesystem.set(otherYamlPath, '');
    filesystem.set(yamlPath, documentA);
    makeReloader([otherYamlPath, yamlPath]);
    await reloader.reloadNow();
    expect(values()).toEqual(['a']);

    filesystem.set(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);
    expect(readAgainMessages()).toEqual([]);
  });

  it('reads each of two files that are rewritten together again', async () => {
    filesystem.set(yamlPath, documentA);
    filesystem.set(otherYamlPath, '{"flagValues": {"flag2": "a"}}');
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();
    expect(values()).toEqual(['a,a']);

    filesystem.set(yamlPath, '');
    filesystem.set(otherYamlPath, '');
    await changeAndSettle();

    // The first file is written. The second is still empty, after it had content.
    filesystem.set(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a,a']);

    filesystem.set(otherYamlPath, '{"flagValues": {"flag2": "b"}}');
    await changeAndSettle();
    expect(values()).toEqual(['a,a', 'b,b']);
    expect(failures).toEqual([]);
  });

  it('applies a file that is deleted and then created empty right away', async () => {
    filesystem.set(yamlPath, documentA);
    makeReloader([yamlPath], (config) => {
      config.skipUnchanged = false;
    });
    await reloader.reloadNow();

    filesystem.remove(yamlPath);
    await changeAndSettle();
    expect(applied[1].files).toEqual([{ path: yamlPath, present: false, flags: 0, segments: 0 }]);

    filesystem.set(yamlPath, '');
    await changeAndSettle();
    expect(applied).toHaveLength(3);
    expect(applied[2].files).toEqual([{ path: yamlPath, present: true, flags: 0, segments: 0 }]);
  });

  it('reads an emptied file again when a retry left over from a failure finds it', async () => {
    filesystem.set(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    // A malformed edit fails the reload and arms the retry.
    filesystem.set(yamlPath, '{"flagValues": ');
    await changeAndSettle();
    expect(failures).toHaveLength(1);

    // The file is rewritten in place, and the retry runs before the new content is written.
    filesystem.set(yamlPath, '');
    await jest.advanceTimersByTimeAsync(retryDelayMs);
    expect(values()).toEqual(['a']);
    expect(failures).toHaveLength(1);

    filesystem.set(yamlPath, documentB);
    await jest.advanceTimersByTimeAsync(retryDelayMs);
    expect(values()).toEqual(['a', 'b']);
  });

  it('parses an emptied file right away when retries are off', async () => {
    filesystem.set(yamlPath, documentA);
    makeReloader([yamlPath], (config) => {
      config.retryDelayMs = 0;
    });
    await reloader.reloadNow();

    filesystem.set(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a', '']);
  });

  it('does not count reading again as a failure, so an unchanged rewrite applies nothing', async () => {
    filesystem.set(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    filesystem.set(yamlPath, '');
    await changeAndSettle();
    filesystem.set(yamlPath, documentA);
    await changeAndSettle();

    // A reload after a failure applies even unchanged content. Reading again is not a failure.
    expect(values()).toEqual(['a']);
    expect(failures).toEqual([]);
  });

  it('reports a failure after reading again as news when the load that found the file empty followed a change', async () => {
    filesystem.set(jsonPath, documentA);
    makeReloader([jsonPath]);
    await reloader.reloadNow();

    // A malformed edit fails, and the retries keep failing the same way.
    filesystem.set(jsonPath, '{"flagValues": ');
    await changeAndSettle();
    await jest.advanceTimersByTimeAsync(retryDelayMs);
    expect(failures.map((failure) => failure.repeated)).toEqual([false, true]);

    // The file is emptied, which is a change. The retry that reads it again finds it still empty.
    // That failure is news, as it would have been for the load that the change started.
    filesystem.set(jsonPath, '');
    await changeAndSettle();
    expect(failures).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(retryDelayMs);
    expect(failures).toHaveLength(3);
    expect(failures[2].repeated).toBe(false);
    expect(failures[2].error.message).toEqual(
      'the file has no content, which is not a JSON document',
    );
    logger.expectMessages([
      { level: LogLevel.Debug, matches: /Reading flag data again after a file was found empty/ },
    ]);
  });

  it('does not read again after close', async () => {
    filesystem.set(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    filesystem.set(yamlPath, '');
    filesystem.deferReads = true;
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(filesystem.pendingReads).toHaveLength(1);
    reloader.close();
    filesystem.completePendingReads();
    await jest.advanceTimersByTimeAsync(retryDelayMs * 2);

    expect(filesystem.readCount).toEqual(2);
    expect(readAgainMessages()).toEqual([]);
    expect(values()).toEqual(['a']);
  });
});
