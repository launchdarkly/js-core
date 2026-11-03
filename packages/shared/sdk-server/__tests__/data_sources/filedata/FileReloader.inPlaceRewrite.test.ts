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
// empty. The clock is Jest's fake clock, so every time below is exact.

const jsonPath = '/data/data.json';
const yamlPath = '/data/data.yaml';
const otherYamlPath = '/data/other.yaml';
const retryDelayMs = 1000;
// The retry that a hold arms comes a tenth of the retry delay after the delay ends.
const holdRetryMs = retryDelayMs + retryDelayMs / 10;

const documentA = '{"flagValues": {"flag1": "a"}}';
const documentB = '{"flagValues": {"flag1": "b"}}';
const documentC = '{"flagValues": {"flag1": "c"}}';
const otherA = '{"flagValues": {"flag2": "a"}}';
const otherB = '{"flagValues": {"flag2": "b"}}';

// A stand-in for a YAML parser. A flow-style document like the ones above is both JSON and YAML.
// Like the YAML parsers, it returns null for content with no document: white space, comments and
// document markers.
const yamlParser = (data: string) => {
  const body = data
    .split('\n')
    .filter((line) => !/^\s*(#.*)?$/.test(line) && line.trim() !== '---')
    .join('\n');
  return hasContent(body) ? JSON.parse(body) : null;
};

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
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // Every write, including a truncation, changes the file's modification time, as it does on a
  // real filesystem.
  const write = (path: string, data: string) => {
    modified += 1;
    filesystem.set(path, data, modified);
  };

  // The policy parses by extension and validates the document as the override source does, so a
  // YAML file with no document has no entries and a JSON file with no content fails.
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

  // Two triggers without a settle in between coalesce into one load, so every change settles.
  const changeAndSettle = async () => {
    reloader.trigger();
    await jest.advanceTimersByTimeAsync(0);
  };

  const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

  const startWith = async (path: string, data: string) => {
    write(path, data);
    makeReloader([path]);
    await reloader.reloadNow();
  };

  it.each(['', ' \n\t\r\n', '\uFEFF'])(
    'holds back an emptied file and applies the rewritten content with no empty application, for content %j',
    async (empty) => {
      await startWith(yamlPath, documentA);

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

  it.each(['# only a comment\n', '---\n', '---\n# a comment\n'])(
    'holds back a YAML file whose content is no document, %j',
    async (content) => {
      await startWith(yamlPath, documentA);

      write(yamlPath, content);
      await changeAndSettle();
      expect(values()).toEqual(['a']);
      expect(readAgainMessages()).toHaveLength(1);

      write(yamlPath, documentB);
      await changeAndSettle();
      expect(values()).toEqual(['a', 'b']);
    },
  );

  it('applies a file that holds an empty document right away', async () => {
    await startWith(yamlPath, documentA);

    write(yamlPath, '{}');
    await changeAndSettle();
    expect(values()).toEqual(['a', '']);
    expect(readAgainMessages()).toEqual([]);
  });

  it('applies a YAML file that stays empty when the retry comes after the delay', async () => {
    await startWith(yamlPath, documentA);

    write(yamlPath, '');
    await changeAndSettle();

    await advance(holdRetryMs - 1);
    expect(values()).toEqual(['a']);
    await advance(1);
    expect(values()).toEqual(['a', '']);
    expect(failures).toEqual([]);
  });

  it('holds back a file until exactly the retry delay has passed', async () => {
    await startWith(yamlPath, documentA);

    write(yamlPath, '');
    await changeAndSettle();
    await advance(retryDelayMs * 0.95);
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    await advance(retryDelayMs * 0.05);
    await changeAndSettle();
    expect(values()).toEqual(['a', '']);
  });

  it('does not report an emptied JSON file at the load that finds it empty, and the retry reports it', async () => {
    await startWith(jsonPath, documentA);

    write(jsonPath, '');
    await changeAndSettle();
    expect(failures).toEqual([]);

    await advance(holdRetryMs);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ kind: 'parse', path: jsonPath, repeated: false });
    expect(failures[0].error.message).toEqual(emptyJson);
    expect(values()).toEqual(['a']);
  });

  it('does not apply a file that stays empty at a further change signal, and the retry applies it when the delay ends', async () => {
    await startWith(yamlPath, documentA);

    write(yamlPath, '');
    await changeAndSettle();
    await advance(500);
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    // The retry that the further load armed comes when the delay that started at the first load
    // ends, plus a tenth of the delay.
    await advance(holdRetryMs - 500 - 1);
    expect(values()).toEqual(['a']);
    await advance(1);
    expect(values()).toEqual(['a', '']);
  });

  it('restarts the delay when the file is written and truncated again between two loads', async () => {
    // Two quick rewrites in watching mode: the write of the first and the truncation of the second
    // fall in one settle window, so no load sees the first one's content.
    await startWith(yamlPath, documentA);

    write(yamlPath, '');
    await changeAndSettle();
    await advance(600);
    write(yamlPath, documentB);
    write(yamlPath, '');
    await changeAndSettle();

    // A load after the first delay would have ended still holds the file back.
    await advance(450);
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    write(yamlPath, documentC);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'c']);
    expect(failures).toEqual([]);
  });

  it('does not apply a file that is mid-rewrite when another file changes', async () => {
    write(yamlPath, documentA);
    write(otherYamlPath, otherA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(300);
    write(otherYamlPath, otherB);
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
    await startWith(yamlPath, documentA);

    write(yamlPath, '');
    await changeAndSettle();
    await advance(400);
    write(yamlPath, documentB);
    await advance(500);
    write(yamlPath, '');
    await advance(holdRetryMs - 900);
    expect(values()).toEqual(['a']);
    expect(readAgainMessages()).toHaveLength(2);

    write(yamlPath, documentC);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'c']);
  });

  it('applies a file that keeps being rewritten so that every load finds it empty, once loads have held it back for five retry delays', async () => {
    await startWith(yamlPath, documentA);

    write(yamlPath, '');
    await changeAndSettle();
    // Every 600 ms the file is written and truncated again before a load reads it.
    await Array.from({ length: 8 }).reduce<Promise<void>>(
      (previous) =>
        previous.then(async () => {
          await advance(600);
          write(yamlPath, documentB);
          write(yamlPath, '');
          await changeAndSettle();
        }),
      Promise.resolve(),
    );
    expect(values()).toEqual(['a']);

    // The last load, at 4800 ms, armed the retry for when the five retry delays end, plus a
    // tenth of the delay.
    await advance(299);
    expect(values()).toEqual(['a']);
    await advance(1);
    expect(values()).toEqual(['a', '']);
  });

  it('applies files that are rewritten in turn, once loads have held them back for five retry delays', async () => {
    write(yamlPath, documentA);
    write(otherYamlPath, otherA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    // Every 600 ms the file that is empty is written and the other one is truncated, so every load
    // finds one of them empty, and each file's own delay starts over.
    await [1, 2, 3, 4, 5, 6, 7, 8].reduce<Promise<void>>(
      (previous, step) =>
        previous.then(async () => {
          await advance(600);
          if (step % 2 === 1) {
            write(yamlPath, documentB);
            write(otherYamlPath, '');
          } else {
            write(otherYamlPath, otherB);
            write(yamlPath, '');
          }
          await changeAndSettle();
        }),
      Promise.resolve(),
    );
    // Changes to the file that has content wait while the other one is held back.
    expect(values()).toEqual(['a,a']);

    await advance(299);
    expect(values()).toEqual(['a,a']);
    await advance(1);
    expect(values()).toEqual(['a,a', 'b']);
  });

  it('starts a fresh hold for a file that is emptied again after its content was read', async () => {
    await startWith(yamlPath, documentA);

    write(yamlPath, '');
    await changeAndSettle();
    await advance(300);
    write(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);

    // The load that applied the content ended the run of holding loads, so a load more than five
    // retry delays after the first hold still holds the file back.
    await advance(4600);
    write(yamlPath, '');
    await changeAndSettle();
    await advance(200);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);

    await advance(holdRetryMs - 200 - 1);
    expect(values()).toEqual(['a', 'b']);
    await advance(1);
    expect(values()).toEqual(['a', 'b', '']);
  });

  it('starts a fresh hold for a JSON file that has been empty for long and is rewritten in place', async () => {
    await startWith(jsonPath, documentA);

    write(jsonPath, '');
    await changeAndSettle();
    await advance(holdRetryMs);
    expect(failures).toHaveLength(1);
    expect(failures[0].error.message).toEqual(emptyJson);

    // The file stays empty, and the retries keep failing. A failing load ends the run of holding
    // loads.
    await advance(10000);
    const failed = failures.length;

    // The file is rewritten in place. Its truncation is a new state, held back without a report.
    write(jsonPath, '');
    await changeAndSettle();
    expect(failures).toHaveLength(failed);
    expect(readAgainMessages()).toHaveLength(2);

    write(jsonPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);
    expect(failures).toHaveLength(failed);
  });

  it('starts a fresh delay for a file that is deleted and created empty again', async () => {
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

    // The data in effect still has the file's content, so the empty file is held back, with a
    // delay that starts when it is found empty again.
    await advance(1900);
    write(jsonPath, '');
    await changeAndSettle();
    await advance(500);
    await changeAndSettle();
    expect(reported().map((failure) => failure.kind)).toEqual(['read']);

    await advance(holdRetryMs - 500 - 1);
    expect(reported().map((failure) => failure.kind)).toEqual(['read']);
    await advance(1);
    expect(reported().map((failure) => failure.kind)).toEqual(['read', 'parse']);
    expect(reported()[1].error.message).toEqual(emptyJson);
  });

  describe('on a filesystem whose modification times are coarse', () => {
    // Every write keeps the same modification time, as two writes within one tick of a coarse
    // clock do, so a file that is empty again looks unchanged since it was last found empty.
    const writeCoarse = (path: string, data: string) => filesystem.set(path, data, 1);

    it('starts a fresh delay for a file emptied again after a failed load read its content', async () => {
      writeCoarse(yamlPath, documentA);
      writeCoarse(jsonPath, otherA);
      makeReloader([yamlPath, jsonPath]);
      await reloader.reloadNow();

      writeCoarse(yamlPath, '');
      await changeAndSettle();
      // The file gets its content, but another file is malformed, so nothing is applied.
      await advance(300);
      writeCoarse(yamlPath, documentB);
      writeCoarse(jsonPath, '{"flagValues": ');
      await changeAndSettle();
      expect(failures).toHaveLength(1);

      // The file is emptied again, more than a retry delay after it was first found empty.
      await advance(1200);
      writeCoarse(yamlPath, '');
      await changeAndSettle();
      await advance(100);
      writeCoarse(jsonPath, otherB);
      await changeAndSettle();
      expect(values()).toEqual(['a,a']);

      writeCoarse(yamlPath, documentC);
      await changeAndSettle();
      expect(values()).toEqual(['a,a', 'c,b']);
    });

    it('starts a fresh delay for a file that is emptied again after its content was read', async () => {
      writeCoarse(yamlPath, documentA);
      makeReloader([yamlPath]);
      await reloader.reloadNow();

      writeCoarse(yamlPath, '');
      await changeAndSettle();
      await advance(300);
      writeCoarse(yamlPath, documentB);
      await changeAndSettle();
      expect(values()).toEqual(['a', 'b']);

      await advance(2000);
      writeCoarse(yamlPath, '');
      await changeAndSettle();
      expect(values()).toEqual(['a', 'b']);
      expect(readAgainMessages()).toHaveLength(2);
    });

    it('starts a fresh delay for a file that is deleted and created empty again', async () => {
      writeCoarse(jsonPath, documentA);
      makeReloader([jsonPath], (config) => {
        config.policy = testPolicy({ missingFile: 'fail' });
      });
      await reloader.reloadNow();

      writeCoarse(jsonPath, '');
      await changeAndSettle();
      await advance(100);
      filesystem.remove(jsonPath);
      await changeAndSettle();
      const reported = () => failures.filter((failure) => !failure.repeated);
      expect(reported().map((failure) => failure.kind)).toEqual(['read']);

      await advance(2000);
      writeCoarse(jsonPath, '');
      await changeAndSettle();
      expect(reported().map((failure) => failure.kind)).toEqual(['read']);
      expect(readAgainMessages()).toHaveLength(2);
    });
  });

  it('does not restart the bound of a file that is held back when another file fails', async () => {
    write(yamlPath, documentA);
    write(jsonPath, otherA);
    makeReloader([yamlPath, jsonPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    // Every 600 ms the first file is written and truncated again before a load reads it, and the
    // other file is malformed at every other step, which fails those loads.
    await [1, 2, 3, 4, 5, 6, 7, 8].reduce<Promise<void>>(
      (previous, step) =>
        previous.then(async () => {
          await advance(600);
          write(yamlPath, documentB);
          write(yamlPath, '');
          write(jsonPath, step % 2 === 0 ? '{"flagValues": ' : otherA);
          await changeAndSettle();
        }),
      Promise.resolve(),
    );
    expect(values()).toEqual(['a,a']);
    expect(failures.length).toBeGreaterThan(0);

    // 5400 ms after it was first held back, the file is applied although it was just written.
    await advance(600);
    write(yamlPath, documentB);
    write(yamlPath, '');
    write(jsonPath, otherB);
    await changeAndSettle();
    expect(values()).toEqual(['a,a', 'b']);
  });

  it("does not cut another file's rewrite short when one file's bound is over", async () => {
    write(yamlPath, documentA);
    write(otherYamlPath, otherA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    // The first file keeps being written and truncated again before every load.
    write(yamlPath, '');
    await changeAndSettle();
    await Array.from({ length: 7 }).reduce<Promise<void>>(
      (previous) =>
        previous.then(async () => {
          await advance(600);
          write(yamlPath, documentB);
          write(yamlPath, '');
          await changeAndSettle();
        }),
      Promise.resolve(),
    );
    // At 4750 ms, a quarter of a retry delay before the first file's bound is over, the second
    // file starts an ordinary in-place rewrite.
    await advance(550);
    write(otherYamlPath, '');
    await changeAndSettle();
    await advance(50);
    write(yamlPath, documentB);
    write(yamlPath, '');
    await changeAndSettle();

    // At 5100 ms the retry finds the first file's bound over, and the second file still in its
    // delay, so nothing is applied.
    await advance(300);
    expect(values()).toEqual(['a,a']);

    write(otherYamlPath, otherB);
    await changeAndSettle();
    expect(values()).toEqual(['a,a', 'b']);
  });

  it('applies files that are emptied in staggered turns once their bounds are over', async () => {
    // Two files stay empty and are truncated again in turn, so that whenever one of them has
    // stayed empty for the whole delay, the other is still within its delay and holds the load
    // back. A file that settles so does not get a fresh bound while the other is held back.
    write(yamlPath, documentA);
    write(otherYamlPath, otherA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    expect(readAgainMessages()).toHaveLength(1);
    // Every 900 ms one file is truncated again, with a load then and one 200 ms later, standing
    // for the retry. The second file is emptied at the first step.
    await Array.from({ length: 14 }, (_, index) => index + 1).reduce<Promise<void>>(
      (previous, step) =>
        previous.then(async () => {
          if (applied.length > 1) {
            return;
          }
          await advance(step === 1 ? 900 : 700);
          write(step % 2 === 1 ? otherYamlPath : yamlPath, '');
          await changeAndSettle();
          await advance(200);
          await changeAndSettle();
        }),
      Promise.resolve(),
    );
    expect(applied.length).toBeGreaterThan(1);
  });

  it('starts the bound of a file held back during a failure over once a failed load reads it', async () => {
    // While the other file fails to load, the first file is rewritten once and its gap is held
    // back. Much later, the other file is fixed while the first file is in the middle of another
    // rewrite, which is held back with a bound of its own.
    write(yamlPath, documentA);
    write(jsonPath, otherA);
    makeReloader([yamlPath, jsonPath]);
    await reloader.reloadNow();

    write(jsonPath, '{"flagValues": ');
    write(yamlPath, '');
    await changeAndSettle();
    write(yamlPath, documentB);
    await changeAndSettle();
    await advance(6 * retryDelayMs);
    // A reload that fails reports the failure, not the files it holds back.
    expect(readAgainMessages()).toEqual([]);

    write(jsonPath, otherB);
    write(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a,a']);
    expect(readAgainMessages()).toHaveLength(1);
  });

  it('asks for the retry from the end of the load, when the read of another file takes longer than the rest of the delay', async () => {
    write(yamlPath, documentA);
    write(otherYamlPath, otherA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    await changeAndSettle();
    await advance(retryDelayMs * 0.95);

    // The first file is still within its delay when it is read. The read of the second file
    // takes 60 ms, past the end of that delay, so the retry is due right away, after the margin.
    const readFile = filesystem.readFile.bind(filesystem);
    jest.spyOn(filesystem, 'readFile').mockImplementation(async (path: string) => {
      if (path === otherYamlPath) {
        await new Promise((resolve) => {
          setTimeout(resolve, 60);
        });
      }
      return readFile(path);
    });
    reloader.trigger();
    await advance(60);
    expect(readAgainMessages()).toHaveLength(2);
    expect(reloader.lastRetryDelayMs).toEqual(retryDelayMs / 10);
  });

  it('reads the clock after each file is read, so a slow read of another file does not shorten the delay', async () => {
    write(otherYamlPath, otherA);
    write(yamlPath, documentA);
    makeReloader([otherYamlPath, yamlPath]);
    await reloader.reloadNow();

    // The read of the first file takes 900 ms. The second file is empty when it is read.
    write(yamlPath, '');
    filesystem.deferReads = true;
    reloader.trigger();
    await advance(0);
    expect(filesystem.pendingReads).toHaveLength(1);
    await advance(900);
    filesystem.deferReads = false;
    filesystem.completePendingReads();
    await advance(0);
    expect(readAgainMessages()).toHaveLength(1);
    expect(reloader.lastRetryDelayMs).toEqual(holdRetryMs);

    // The delay started when the second file was read, so a load 500 ms later still holds it back.
    await advance(500);
    await changeAndSettle();
    expect(values()).toEqual(['a,a']);
  });

  it('asks for a retry a retry delay and a tenth after the first hold', async () => {
    await startWith(yamlPath, documentA);
    write(yamlPath, '');
    await changeAndSettle();
    expect(reloader.lastRetryDelayMs).toEqual(holdRetryMs);
  });

  it('asks for a retry when the delay ends, plus a tenth, after a later hold', async () => {
    await startWith(yamlPath, documentA);
    write(yamlPath, '');
    await changeAndSettle();
    await advance(500);
    await changeAndSettle();
    expect(reloader.lastRetryDelayMs).toEqual(holdRetryMs - 500);
  });

  it('asks for a retry when the bound ends, plus a tenth, when that is sooner', async () => {
    await startWith(yamlPath, documentA);
    write(yamlPath, '');
    await changeAndSettle();
    await Array.from({ length: 8 }).reduce<Promise<void>>(
      (previous) =>
        previous.then(async () => {
          await advance(600);
          write(yamlPath, documentB);
          write(yamlPath, '');
          await changeAndSettle();
        }),
      Promise.resolve(),
    );
    // At 4800 ms the file's delay would end at 5800 ms, and its bound ends at 5000 ms.
    expect(reloader.lastRetryDelayMs).toEqual(5000 - 4800 + retryDelayMs / 10);
  });

  it.each([
    ['first', [yamlPath, otherYamlPath]],
    ['second', [otherYamlPath, yamlPath]],
  ])(
    'asks for a retry when the file whose delay ends first is due, when that file is configured %s',
    async (_order, paths) => {
      write(yamlPath, documentA);
      write(otherYamlPath, otherA);
      makeReloader(paths);
      await reloader.reloadNow();

      write(yamlPath, '');
      await changeAndSettle();
      await advance(400);
      write(otherYamlPath, '');
      await changeAndSettle();
      expect(readAgainMessages()).toHaveLength(3);
      expect(reloader.lastRetryDelayMs).toEqual(holdRetryMs - 400);
    },
  );

  it('asks for a retry the same way for a hold by a retry', async () => {
    await startWith(yamlPath, documentA);
    write(yamlPath, '{"flagValues": ');
    await changeAndSettle();
    expect(reloader.lastRetryDelayMs).toEqual(retryDelayMs);

    write(yamlPath, '');
    await advance(retryDelayMs);
    expect(readAgainMessages()).toHaveLength(1);
    expect(reloader.lastRetryDelayMs).toEqual(holdRetryMs);
  });

  it('asks for a retry a retry delay after a failure', async () => {
    await startWith(jsonPath, documentA);
    write(jsonPath, '{"flagValues": ');
    await changeAndSettle();
    expect(failures).toHaveLength(1);
    expect(reloader.lastRetryDelayMs).toEqual(retryDelayMs);
  });

  it('holds back a file emptied again after a read of its content when its state looks the same', async () => {
    // On a filesystem that records modification times coarsely, a file emptied a second time can
    // look exactly as it did the first time. The read of its content in between still starts its
    // delay over. The other file is kept written while empty, so that no load applies.
    write(yamlPath, documentA);
    write(otherYamlPath, otherA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    const firstEmptyModified = modified;
    write(otherYamlPath, '');
    await changeAndSettle();
    expect(readAgainMessages()).toHaveLength(2);

    await advance(500);
    write(yamlPath, documentA);
    write(otherYamlPath, '');
    await changeAndSettle();

    await advance(400);
    filesystem.set(yamlPath, '', firstEmptyModified);
    write(otherYamlPath, '');
    await changeAndSettle();

    // The other file gets its content back while the first file is still within its new delay.
    await advance(700);
    write(otherYamlPath, otherB);
    await changeAndSettle();
    expect(values()).toEqual(['a,a']);
  });

  it('holds back a file whose content moved to it from another configured file', async () => {
    // The content in effect comes from the second file. Moving it to the first leaves the
    // contents the same, so the load applies nothing, but the first file now contributes them.
    write(otherYamlPath, documentA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();
    expect(values()).toEqual(['a']);

    filesystem.remove(otherYamlPath);
    write(yamlPath, documentA);
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    write(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a']);

    write(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a', 'b']);
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
    write(otherYamlPath, otherA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    write(otherYamlPath, '');
    await changeAndSettle();

    // The first file is written. The second is still empty.
    write(yamlPath, documentB);
    await changeAndSettle();
    expect(values()).toEqual(['a,a']);

    write(otherYamlPath, otherB);
    await changeAndSettle();
    expect(values()).toEqual(['a,a', 'b,b']);
    expect(failures).toEqual([]);
  });

  it('applies two files that are emptied together and stay empty at the same retry', async () => {
    write(yamlPath, documentA);
    write(otherYamlPath, otherA);
    makeReloader([yamlPath, otherYamlPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    write(otherYamlPath, '');
    await changeAndSettle();
    expect(readAgainMessages()).toHaveLength(2);

    // Both files started their delays in the same load.
    await advance(holdRetryMs - 1);
    expect(values()).toEqual(['a,a']);
    await advance(1);
    expect(values()).toEqual(['a,a', '']);
  });

  it('reports a failure of another file even when a file is held back', async () => {
    write(yamlPath, documentA);
    write(jsonPath, otherA);
    makeReloader([yamlPath, jsonPath]);
    await reloader.reloadNow();

    write(yamlPath, '');
    write(jsonPath, '{"flagValues": ');
    await changeAndSettle();

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ kind: 'parse', path: jsonPath, repeated: false });
    expect(values()).toEqual(['a,a']);
  });

  it('applies a file that is deleted and then created empty right away, where a missing file contributes nothing', async () => {
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
    await startWith(yamlPath, documentA);

    // A malformed edit fails the reload and arms the retry.
    write(yamlPath, '{"flagValues": ');
    await changeAndSettle();
    expect(failures).toHaveLength(1);

    // The file is rewritten in place, and the retry runs before the new content is written.
    write(yamlPath, '');
    await advance(retryDelayMs);
    expect(values()).toEqual(['a']);
    expect(failures).toHaveLength(1);
    expect(readAgainMessages()).toHaveLength(1);

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
    await advance(holdRetryMs);
    expect(values()).toEqual(['a', '']);

    // The file is written empty again: nothing it supplied is in effect, so nothing is held back.
    write(yamlPath, ' ');
    await changeAndSettle();
    expect(values()).toEqual(['a', '', '']);
  });

  it('does not count holding back as a failure, so an unchanged rewrite applies nothing', async () => {
    await startWith(yamlPath, documentA);

    write(yamlPath, '');
    await changeAndSettle();
    write(yamlPath, documentA);
    await changeAndSettle();

    // A reload after a failure applies even unchanged content. Holding back is not a failure.
    expect(values()).toEqual(['a']);
    expect(failures).toEqual([]);
  });

  it('holds back a file when its state cannot be read', async () => {
    await startWith(yamlPath, documentA);
    jest.spyOn(filesystem, 'getFileStats').mockRejectedValue(new Error('EIO: i/o error'));

    write(yamlPath, '');
    await changeAndSettle();
    expect(values()).toEqual(['a']);
    expect(readAgainMessages()).toHaveLength(1);
    expect(logger.getMessages(LogLevel.Error)).toEqual([]);

    await advance(holdRetryMs);
    expect(values()).toEqual(['a', '']);
  });

  describe('when a failure is reported after a hold', () => {
    // The file is malformed, and a retry has repeated the failure, so the last report is a parse
    // failure of the file.
    const startFailing = async () => {
      await startWith(jsonPath, documentA);
      write(jsonPath, '{"flagValues": ');
      await changeAndSettle();
      await advance(retryDelayMs);
      expect(failures.map((failure) => failure.repeated)).toEqual([false, true]);
    };

    it('reports it as news when the load that held the file back followed a change', async () => {
      await startFailing();

      // The file is emptied, which is a change. The retry that reads it again finds it still
      // empty. That failure is news, as it would have been for the load that the change started.
      write(jsonPath, '');
      await changeAndSettle();
      expect(failures).toHaveLength(2);
      await advance(holdRetryMs);
      expect(failures).toHaveLength(3);
      expect(failures[2].repeated).toBe(false);
      expect(failures[2].error.message).toEqual(emptyJson);
      logger.expectMessages([
        { level: LogLevel.Debug, matches: /Reading flag data again after a file was found empty/ },
      ]);
    });

    it('reports it as a repeat when a retry held the file back and the next retry fails', async () => {
      await startFailing();

      // A retry finds the file emptied, without a change signal, and holds it back. The retry
      // after it continues that retry, so its failure on the same file is a repeat.
      write(jsonPath, '');
      await advance(retryDelayMs);
      expect(failures).toHaveLength(2);
      expect(readAgainMessages()).toHaveLength(1);
      await advance(holdRetryMs);
      expect(failures).toHaveLength(3);
      expect(failures[2].repeated).toBe(true);
    });

    it('reports it as news when a change follows a hold by a retry', async () => {
      await startFailing();

      write(jsonPath, '');
      await advance(retryDelayMs);
      expect(failures).toHaveLength(2);
      expect(readAgainMessages()).toHaveLength(1);

      // A change signal does not continue the retry that held the file back.
      write(jsonPath, '{"flagValues": ');
      await changeAndSettle();
      expect(failures).toHaveLength(3);
      expect(failures[2].repeated).toBe(false);
    });
  });

  it('does not read again after close', async () => {
    await startWith(yamlPath, documentA);

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
