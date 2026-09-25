import {
  FileDataReadError,
  FileReloader,
  FileReloaderConfig,
  ReloadResult,
} from '../../../src/data_sources/filedata';
import TestLogger, { LogLevel } from '../../Logger';
import MockFilesystem from './MockFilesystem';

const path = '/data/data.json';
const second = '/data/second.json';

// A reload starts on a microtask after it is requested. Let it begin before asserting.
const flushMicrotasks = () => jest.advanceTimersByTimeAsync(0);

async function repeat(count: number, action: () => Promise<void>): Promise<void> {
  await Array.from({ length: count }).reduce<Promise<void>>(
    (previous) => previous.then(action),
    Promise.resolve(),
  );
}

describe('given a reloader over a mock filesystem', () => {
  let filesystem: MockFilesystem;
  let logger: TestLogger;
  let applied: ReloadResult[];
  let errored: Error[];
  let reloader: FileReloader;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    logger = new TestLogger();
    applied = [];
    errored = [];
  });

  afterEach(() => {
    reloader?.close();
    jest.useRealTimers();
  });

  const makeReloader = (configure?: (config: FileReloaderConfig) => void) => {
    const config: FileReloaderConfig = {
      paths: [path],
      duplicateKeysHandling: 'fail',
      skipMissingPaths: false,
      filesystem,
      logger,
      apply: (result) => applied.push(result),
      onError: (err) => errored.push(err),
      debounceDelayMs: 0,
      retryDelayMs: 0,
      skipUnchanged: false,
    };
    configure?.(config);
    reloader = new FileReloader(config);
    return reloader;
  };

  it('applies the initial load', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader();

    await reloader.reloadNow();

    expect(applied).toHaveLength(1);
    expect(applied[0].flags.map((flag) => flag.key)).toEqual(['flag1']);
    expect(applied[0].files).toEqual([{ path, present: true, flags: 1, segments: 0 }]);
    expect(errored).toHaveLength(0);
  });

  it('fails on a missing path by default', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader((config) => {
      config.paths = [path, second];
    });

    await reloader.reloadNow();

    expect(applied).toHaveLength(0);
    expect(errored).toHaveLength(1);
    expect(errored[0]).toBeInstanceOf(FileDataReadError);
    expect((errored[0] as FileDataReadError).path).toEqual(second);
    expect(errored[0].message).toMatch(/unable to read file/);
    logger.expectMessages([{ level: LogLevel.Error, matches: /Unable to load flags/ }]);
  });

  it('skips missing paths when configured', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader((config) => {
      config.paths = [path, second];
      config.skipMissingPaths = true;
      config.skipUnchanged = true;
    });

    // Step 1: one file exists and one does not. The reload succeeds with the existing file.
    await reloader.reloadNow();
    expect(applied).toHaveLength(1);
    expect(applied[0].flags.map((flag) => flag.key)).toEqual(['flag1']);
    expect(applied[0].files).toEqual([
      { path, present: true, flags: 1, segments: 0 },
      { path: second, present: false, flags: 0, segments: 0 },
    ]);

    // Step 2: the missing file appears. Its data is merged in.
    filesystem.set(second, '{"flagValues": {"flag2": true}}');
    await reloader.reloadNow();
    expect(applied).toHaveLength(2);
    expect(applied[1].flags.map((flag) => flag.key)).toEqual(['flag1', 'flag2']);
    expect(applied[1].files[1]).toEqual({ path: second, present: true, flags: 1, segments: 0 });

    // Step 3: the file is deleted. Its data is gone and the reload still succeeds.
    filesystem.remove(second);
    await reloader.reloadNow();
    expect(applied).toHaveLength(3);
    expect(applied[2].flags.map((flag) => flag.key)).toEqual(['flag1']);
    expect(errored).toHaveLength(0);
    expect(logger.getCount(LogLevel.Error)).toEqual(0);
  });

  it('reports a parse failure and applies nothing', async () => {
    filesystem.set(path, '{"flagValues"');
    makeReloader();

    await reloader.reloadNow();

    expect(applied).toHaveLength(0);
    expect(errored).toHaveLength(1);
    expect(errored[0]).toBeInstanceOf(FileDataReadError);
    expect((errored[0] as FileDataReadError).path).toEqual(path);
    expect(errored[0].message).toMatch(/error parsing file/);
  });

  it('reports a merge failure', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    filesystem.set(second, '{"flagValues": {"flag1": false}}');
    makeReloader((config) => {
      config.paths = [path, second];
    });

    await reloader.reloadNow();

    expect(applied).toHaveLength(0);
    expect(errored).toHaveLength(1);
    expect(errored[0]).not.toBeInstanceOf(FileDataReadError);
    expect(errored[0].message).toEqual("flag 'flag1' is specified by multiple files");
  });

  it('merges multiple files in order', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": "first"}}');
    filesystem.set(second, '{"flagValues": {"flag1": "second"}}');
    makeReloader((config) => {
      config.paths = [path, second];
      config.duplicateKeysHandling = 'ignore';
    });

    await reloader.reloadNow();

    expect(applied).toHaveLength(1);
    expect(applied[0].flags).toHaveLength(1);
    expect(applied[0].flags[0].variations).toEqual(['first']);
    expect(applied[0].files).toEqual([
      { path, present: true, flags: 1, segments: 0 },
      { path: second, present: true, flags: 0, segments: 0 },
    ]);
  });

  it('reloads after a trigger and logs the reason', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader();
    await reloader.reloadNow();

    filesystem.set(path, '{"flagValues": {"flag1": false}}');
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);

    expect(applied).toHaveLength(2);
    expect(applied[1].flags[0].variations).toEqual([false]);
    logger.expectMessages([
      { level: LogLevel.Info, matches: /Reloading flag data after detecting a change/ },
    ]);
  });

  it('coalesces a burst of triggers into one reload', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader((config) => {
      config.debounceDelayMs = 400;
    });
    await reloader.reloadNow();

    filesystem.set(path, '{"flagValues": {"flag1": false}}');
    await repeat(20, async () => {
      reloader.trigger();
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(applied).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(400);
    expect(applied).toHaveLength(2);

    await jest.advanceTimersByTimeAsync(1000);
    expect(applied).toHaveLength(2);
  });

  it('extends the debounce window with each trigger', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader((config) => {
      config.debounceDelayMs = 250;
    });
    await reloader.reloadNow();

    // Triggers arrive closer together than the window for five windows. No reload runs while
    // they keep arriving.
    await repeat(25, async () => {
      reloader.trigger();
      await jest.advanceTimersByTimeAsync(50);
    });
    expect(applied).toHaveLength(1);

    // One reload runs after the stream stops.
    await jest.advanceTimersByTimeAsync(250);
    expect(applied).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(500);
    expect(applied).toHaveLength(2);
  });

  it('reports an identical failure only once and re-arms after a success', async () => {
    filesystem.set(path, '{"flagValues"');
    makeReloader((config) => {
      config.retryDelayMs = 10;
    });

    await reloader.reloadNow();
    expect(errored).toHaveLength(1);

    // The automatic retries keep failing identically. The failure is not reported again and
    // not logged again at error level.
    await jest.advanceTimersByTimeAsync(200);
    expect(errored).toHaveLength(1);
    expect(logger.getCount(LogLevel.Error)).toEqual(1);
    expect(logger.getCount(LogLevel.Debug)).toBeGreaterThan(0);

    // A different failure is a new report.
    filesystem.set(path, '{"flagValues": {bad}}');
    await jest.advanceTimersByTimeAsync(10);
    expect(errored).toHaveLength(2);
    expect(errored[1].message).toMatch(/error parsing file/);
    expect(logger.getCount(LogLevel.Error)).toEqual(2);

    // A success re-arms reporting. The same failure afterward is reported again.
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    await jest.advanceTimersByTimeAsync(10);
    expect(applied).toHaveLength(1);
    filesystem.set(path, '{"flagValues"');
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(errored).toHaveLength(3);
  });

  it('retries after a failure without further triggers', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader((config) => {
      config.retryDelayMs = 20;
    });
    await reloader.reloadNow();
    expect(applied).toHaveLength(1);

    filesystem.set(path, '{"flagValues"');
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(errored).toHaveLength(1);
    expect(applied).toHaveLength(1);

    // Fix the file without a trigger. Only the automatic retry can observe the fix.
    filesystem.set(path, '{"flagValues": {"flag1": false}}');
    await jest.advanceTimersByTimeAsync(20);
    expect(applied).toHaveLength(2);
    expect(applied[1].flags[0].variations).toEqual([false]);
    logger.expectMessages([
      { level: LogLevel.Debug, matches: /Retrying flag data load after earlier failure/ },
    ]);
  });

  it('stops retrying after a success', async () => {
    filesystem.set(path, '{"flagValues"');
    makeReloader((config) => {
      config.retryDelayMs = 10;
      config.skipUnchanged = true;
    });
    await reloader.reloadNow();
    expect(errored).toHaveLength(1);

    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    await jest.advanceTimersByTimeAsync(10);
    expect(applied).toHaveLength(1);

    // No reload happens without a trigger once the retry has succeeded.
    filesystem.set(path, '{"flagValues": {"flag1": false}}');
    await jest.advanceTimersByTimeAsync(100);
    expect(applied).toHaveLength(1);
  });

  it('does not retry when the retry delay is disabled', async () => {
    filesystem.set(path, '{"flagValues"');
    makeReloader();
    await reloader.reloadNow();
    expect(errored).toHaveLength(1);

    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    await jest.advanceTimersByTimeAsync(5000);
    expect(applied).toHaveLength(0);
  });

  it('skips an application when the content is unchanged', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader((config) => {
      config.skipUnchanged = true;
    });
    await reloader.reloadNow();
    expect(applied).toHaveLength(1);

    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(applied).toHaveLength(1);

    filesystem.set(path, '{"flagValues": {"flag1": false}}');
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(applied).toHaveLength(2);
  });

  it('applies a recovery even when the content is unchanged', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader((config) => {
      config.skipUnchanged = true;
    });
    await reloader.reloadNow();
    expect(applied).toHaveLength(1);

    // A reload fails. The consumer hears about it through onError.
    filesystem.remove(path);
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(errored).toHaveLength(1);

    // The file comes back with identical content. Only apply tells the consumer that the
    // interruption is over, so the success is applied.
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(applied).toHaveLength(2);

    // Once recovered, identical content skips again.
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(applied).toHaveLength(2);
  });

  it('applies every reload when skip unchanged is off', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader();
    await reloader.reloadNow();
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
    expect(applied).toHaveLength(2);
  });

  it('does nothing after close', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    makeReloader((config) => {
      config.retryDelayMs = 10;
    });
    await reloader.reloadNow();
    expect(applied).toHaveLength(1);

    reloader.close();
    reloader.close();
    filesystem.set(path, '{"flagValues": {"flag1": false}}');
    reloader.trigger();
    await reloader.reloadNow();
    await jest.advanceTimersByTimeAsync(100);
    expect(applied).toHaveLength(1);
    expect(errored).toHaveLength(0);
  });

  it('does not deliver the result of a reload that completes after close', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    filesystem.deferReads = true;
    makeReloader();

    const pending = reloader.reloadNow();
    await flushMicrotasks();
    expect(filesystem.pendingReads).toHaveLength(1);

    reloader.close();
    filesystem.completePendingReads();
    await pending;

    expect(applied).toHaveLength(0);
    expect(errored).toHaveLength(0);
  });

  it('does not deliver a failure from a reload that completes after close', async () => {
    filesystem.deferReads = true;
    makeReloader((config) => {
      config.retryDelayMs = 10;
    });

    const pending = reloader.reloadNow();
    await flushMicrotasks();
    expect(filesystem.pendingReads).toHaveLength(1);
    reloader.close();
    filesystem.completePendingReads();
    await pending;
    await jest.advanceTimersByTimeAsync(100);

    expect(errored).toHaveLength(0);
    expect(logger.getCount(LogLevel.Error)).toEqual(0);
  });

  it('runs reloads one at a time', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    filesystem.deferReads = true;
    makeReloader();

    const first = reloader.reloadNow();
    await flushMicrotasks();
    expect(filesystem.readCount).toEqual(1);

    // The second reload waits for the first to finish before it reads anything.
    filesystem.deferReads = false;
    const second2 = reloader.reloadNow();
    await flushMicrotasks();
    expect(filesystem.readCount).toEqual(1);
    expect(applied).toHaveLength(0);

    filesystem.completePendingReads();
    await first;
    await second2;
    expect(filesystem.readCount).toEqual(2);
    expect(applied).toHaveLength(2);
  });

  it('coalesces triggers that arrive while a reload is in progress', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    filesystem.deferReads = true;
    makeReloader();

    const first = reloader.reloadNow();
    await flushMicrotasks();
    expect(filesystem.readCount).toEqual(1);
    reloader.trigger();
    reloader.trigger();
    reloader.trigger();
    await flushMicrotasks();
    expect(filesystem.readCount).toEqual(1);

    filesystem.deferReads = false;
    filesystem.completePendingReads();
    await first;
    await jest.advanceTimersByTimeAsync(0);

    // One reload for the initial load and one for the whole burst.
    expect(filesystem.readCount).toEqual(2);
    expect(applied).toHaveLength(2);
  });

  it('reads the files in the configured order on every reload', async () => {
    filesystem.set(path, '{"flagValues": {"flag1": true}}');
    filesystem.set(second, '{"flagValues": {"flag2": true}}');
    const readFile = jest.spyOn(filesystem, 'readFile');
    makeReloader((config) => {
      config.paths = [second, path];
    });

    await reloader.reloadNow();
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);

    expect(readFile.mock.calls.map((call) => call[0])).toEqual([second, path, second, path]);
    expect(applied[1].flags.map((flag) => flag.key)).toEqual(['flag2', 'flag1']);
  });

  it('passes the YAML parser to the document parser', async () => {
    const yamlParser = jest.fn(() => ({ flagValues: { flag1: true } }));
    filesystem.set('/data/data.yaml', 'flagValues:\n  flag1: true\n');
    makeReloader((config) => {
      config.paths = ['/data/data.yaml'];
      config.yamlParser = yamlParser;
    });

    await reloader.reloadNow();

    expect(yamlParser).toHaveBeenCalledWith('flagValues:\n  flag1: true\n');
    expect(applied).toHaveLength(1);
    expect(applied[0].flags.map((flag) => flag.key)).toEqual(['flag1']);
  });
});
