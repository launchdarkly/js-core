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
const documentC = '{"flagValues": {"flag1": "c"}}';

// A stand-in for a YAML parser. A flow-style document like the ones above is both JSON and YAML,
// and like the YAML parsers, it returns null for a file with no content.
const yamlParser = (data: string) => (hasContent(data) ? JSON.parse(data) : null);

const emptiedReadAgain = /is empty, possibly while it is being rewritten; reading it again/;
const emptyJson = 'the file has no content, which is not a JSON document';

describe('given a reloader over a file that is rewritten in place', () => {
  let filesystem: MockFilesystem;
  let logger: TestLogger;
  let applied: ReloadResult[];
  let failures: LoadFailure[];
  let reloader: FileReloader;
  let modified: number;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    logger = new TestLogger();
    applied = [];
    failures = [];
    modified = 0;
  });

  afterEach(() => {
    reloader?.close();
    jest.useRealTimers();
  });

  // Every write, including a truncation, changes the file's modification time, as it does on a
  // real filesystem.
  const write = (path: string, data: string) => {
    modified += 1;
    filesystem.set(path, data, modified);
  };

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

  const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

  it.each(['', ' \n\t\r\n', '\uFEFF'])(
    'reads an emptied file again and applies the rewritten content with no empty application, for content %j',
    async (empty) => {
      write(yamlPath, documentA);
      makeReloader([yamlPath]);
      await reloader.reloadNow();

      write(yamlPath, empty);
      await changeAndSettle();
      expect(values()).toEqual(['a']);
      expect(failures).toEqual([]);
      logger.expectMessages([{ level: LogLevel.Debug, matches: emptiedReadAgain }]);

      write(yamlPath, documentB);
      await changeAndSettle();
      expect(values()).toEqual(['a', 'b']);
      expect(failures).toEqual([]);
    },
  );

  it('applies a YAML file that stays empty once it has been empty for the retry delay', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    await advance(retryDelayMs - 1);
    expect(values()).toEqual(['a']);
    await advance(1);
    expect(values()).toEqual(['a', '']);
    expect(failures).toEqual([]);
  });

  it('applies a file that stays empty at a load nine tenths of a retry delay after it was found empty', async () => {
    // The retry comes a retry delay after the hold, and a timer can fire slightly early. The slack
    // makes sure that the retry applies a file that stayed empty.
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(retryDelayMs * 0.9 - 1);
    await changeAndSettle();
    expect(values()).toEqual(['a']);
    await advance(1);
    await changeAndSettle();
    expect(values()).toEqual(['a', '']);
  });

  it('does not report an emptied JSON file at the load that finds it empty, and the retry reports it', async () => {
    write(jsonPath, documentA);
    makeReloader([jsonPath]);
    await reloader.reloadNow();

    write(jsonPath, '');
    await changeAndSettle();
    expect(failures).toEqual([]);

    await advance(retryDelayMs);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ kind: 'parse', path: jsonPath, repeated: false });
    expect(failures[0].error.message).toEqual(emptyJson);
    expect(values()).toEqual(['a']);
  });

  it('does not apply a file that stays empty at a further change signal within the retry delay', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(500);
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    // The retry that the further change signal armed applies the file a retry delay later.
    await advance(retryDelayMs - 1);
    expect(values()).toEqual(['a']);
    await advance(1);
    expect(values()).toEqual(['a', '']);
  });

  it('restarts the delay when the file is written and truncated again between two loads', async () => {
    // Two quick rewrites in watching mode: the write of the first and the truncation of the second
    // fall in one settle window, so no load sees the first one's content.
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(600);
    write(yamlPath, documentB);
    write(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    // The first emptying alone would be applied now. The second restarted the delay.
    await advance(retryDelayMs - 600);
    expect(values()).toEqual(['a']);

    write(yamlPath, documentC);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'c']);
    expect(failures).toEqual([]);
  });

  it('does not apply a file that is mid-rewrite when another file changes', async () => {
    write(yamlPath, documentA);
    write(otherYamlPath, '{"flagValues": {"flag2": "a"}}');
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(300);
    write(otherYamlPath, '{"flagValues": {"flag2": "b"}}');
    await changeAndSettle();
    expect(values()).toEqual(['a,a']);

    await advance(200);
    write(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a,a', 'b,b']);
    expect(failures).toEqual([]);
  });

  it('does not apply the truncation of a later rewrite that the retry finds', async () => {
    // Polling with two rewrites about a second apart: no load reads the first one's content
    // before the second truncation.
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(400);
    write(yamlPath, documentB);
    await advance(500);
    write(yamlPath, '');
    await advance(100);
    expect(values()).toEqual(['a']);
    expect(readAgainMessages()).toHaveLength(2);

    write(yamlPath, documentC);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'c']);
  });

  it('applies a file that keeps being rewritten so that every load finds it empty, once five retry delays have passed since a load first found it empty', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    // Every 600 ms the file is written and truncated again before a load reads it.
    const rewriteBeforeALoad = async () => {
      await advance(600);
      write(yamlPath, documentB);
      write(yamlPath, '');
      await changeAndSettle();
    };
    await Array.from({ length: 8 }).reduce<Promise<void>>(
      (previous) => previous.then(rewriteBeforeALoad),
      Promise.resolve(),
    );
    expect(values()).toEqual(['a']);

    // 5400 ms after a load first found it empty, the file is applied although it was just written.
    await rewriteBeforeALoad();
    expect(values()).toEqual(['a', '']);
  });

  it('starts a new delay for a file that is emptied again after its content was read', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(300);
    write(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);

    // Later, within five retry delays of the first emptying, the file is emptied again. A load
    // 200 ms after that, and more than five retry delays after the first emptying, holds it back.
    await advance(4600);
    write(yamlPath, '');
    await changeAndSettle();
    await advance(200);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);
    await advance(retryDelayMs - 1);
    expect(values()).toEqual(['a', 'b']);
    await advance(1);
    expect(values()).toEqual(['a', 'b', '']);
  });

  it('starts a new delay for a file that is deleted and created empty again', async () => {
    write(jsonPath, documentA);
    makeReloader([jsonPath], (config) => {
      config.policy = testPolicy({ missingFile: 'fail' });
    });
    await reloader.reloadNow();

    write(jsonPath, '');
    await changeAndSettle();
    await advance(100);
    filesystem.remove(jsonPath);
    await changeAndSettle();
    // The retries keep failing to read the missing file, as repeats.
    const reported = () => failures.filter((failure) => !failure.repeated);
    expect(reported().map((failure) => failure.kind)).toEqual(['read']);

    // The data in effect still has the file's content, so the empty file is held back, with a new
    // delay: a load more than five retry delays after the first emptying holds it back.
    await advance(4400);
    write(jsonPath, '');
    await changeAndSettle();
    await advance(600);
    await changeAndSettle();
    expect(reported().map((failure) => failure.kind)).toEqual(['read']);
    await advance(retryDelayMs - 1);
    expect(reported().map((failure) => failure.kind)).toEqual(['read']);
    await advance(1);
    expect(reported().map((failure) => failure.kind)).toEqual(['read', 'parse']);
    expect(reported()[1].error.message).toEqual(emptyJson);
  });

  it('never holds back an empty placeholder file, and it does not delay a change to another file', async () => {
    write(otherYamlPath, '');
    write(yamlPath, documentA);
    makeReloader([otherYamlPath, yamlPath]);
    await reloader.reloadNow();
    expect(values()).toEqual(['a']);

    write(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);
    expect(readAgainMessages()).toEqual([]);
  });

  it('holds back each of two files that are rewritten together', async () => {
    write(yamlPath, documentA);
    write(otherYamlPath, '{"flagValues": {"flag2": "a"}}');
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();
    expect(values()).toEqual(['a,a']);

    write(yamlPath, '');
    write(otherYamlPath, '');
    await changeAndSettle();

    // The first file is written. The second is still empty.
    write(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a,a']);

    write(otherYamlPath, '{"flagValues": {"flag2": "b"}}');
    await changeAndSettle();
    expect(values()).toEqual(['a,a', 'b,b']);
    expect(failures).toEqual([]);
  });

  it('applies two files that are emptied together and stay empty one retry delay later', async () => {
    write(yamlPath, documentA);
    write(otherYamlPath, '{"flagValues": {"flag2": "a"}}');
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    write(otherYamlPath, '');
    await changeAndSettle();
    expect(readAgainMessages()).toHaveLength(2);

    // Both files started their delays in the same load.
    await advance(retryDelayMs - 1);
    expect(values()).toEqual(['a,a']);
    await advance(1);
    expect(values()).toEqual(['a,a', '']);
  });

  it('reports a failure of another file even when a file is held back', async () => {
    write(yamlPath, documentA);
    write(jsonPath, '{"flagValues": {"flag2": "a"}}');
    makeReloader([yamlPath, jsonPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    write(jsonPath, '{"flagValues": ');
    await changeAndSettle();

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ kind: 'parse', path: jsonPath, repeated: false });
    expect(values()).toEqual(['a,a']);
  });

  it('applies a file that is deleted and then created empty right away', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath], (config) => {
      config.skipUnchanged = false;
    });
    await reloader.reloadNow();

    filesystem.remove(yamlPath);
    await changeAndSettle();
    expect(applied[1].files).toEqual([{ path: yamlPath, present: false, flags: 0, segments: 0 }]);

    write(yamlPath, '');
    await changeAndSettle();
    expect(applied).toHaveLength(3);
    expect(applied[2].files).toEqual([{ path: yamlPath, present: true, flags: 0, segments: 0 }]);
  });

  it('holds back an emptied file when a retry left over from a failure finds it', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    // A malformed edit fails the reload and arms the retry.
    write(yamlPath, '{"flagValues": ');
    await changeAndSettle();
    expect(failures).toHaveLength(1);

    // The file is rewritten in place, and the retry runs before the new content is written.
    write(yamlPath, '');
    await advance(retryDelayMs);
    expect(values()).toEqual(['a']);
    expect(failures).toHaveLength(1);

    write(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);
  });

  it('parses an emptied file right away when retries are off', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath], (config) => {
      config.retryDelayMs = 0;
    });
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a', '']);
  });

  it('does not hold back an empty file again once its empty state is in effect', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath], (config) => {
      config.skipUnchanged = false;
    });
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(retryDelayMs);
    expect(values()).toEqual(['a', '']);

    // The file is written empty again: nothing it supplied is in effect, so nothing is held back.
    write(yamlPath, ' ');
    await changeAndSettle();
    expect(values()).toEqual(['a', '', '']);
  });

  it('does not count holding back as a failure, so an unchanged rewrite applies nothing', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    write(yamlPath, documentA);
    await changeAndSettle();

    // A reload after a failure applies even unchanged content. Holding back is not a failure.
    expect(values()).toEqual(['a']);
    expect(failures).toEqual([]);
  });

  it('reports a failure after reading again as news when the load that found the file empty followed a change', async () => {
    write(jsonPath, documentA);
    makeReloader([jsonPath]);
    await reloader.reloadNow();

    // A malformed edit fails, and the retries keep failing the same way.
    write(jsonPath, '{"flagValues": ');
    await changeAndSettle();
    await advance(retryDelayMs);
    expect(failures.map((failure) => failure.repeated)).toEqual([false, true]);

    // The file is emptied, which is a change. The retry that reads it again finds it still empty.
    // That failure is news, as it would have been for the load that the change started.
    write(jsonPath, '');
    await changeAndSettle();
    expect(failures).toHaveLength(2);
    await advance(retryDelayMs);
    expect(failures).toHaveLength(3);
    expect(failures[2].repeated).toBe(false);
    expect(failures[2].error.message).toEqual(emptyJson);
    logger.expectMessages([
      { level: LogLevel.Debug, matches: /Reading flag data again after a file was found empty/ },
    ]);
  });

  it('does not read again after close', async () => {
    write(yamlPath, documentA);
    makeReloader([yamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    filesystem.deferReads = true;
    reloader.trigger();
    await advance(0);
    expect(filesystem.pendingReads).toHaveLength(1);
    reloader.close();
    filesystem.completePendingReads();
    await advance(retryDelayMs * 2);

    expect(filesystem.readCount).toEqual(2);
    expect(readAgainMessages()).toEqual([]);
    expect(values()).toEqual(['a']);
  });
});
