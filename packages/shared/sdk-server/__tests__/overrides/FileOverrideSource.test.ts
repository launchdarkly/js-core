import { LDKeyedFeatureStoreItem, LDOverrideSink } from '../../src/api/subsystems';
import { FileOverrideSource, FileOverrideSourceConfig } from '../../src/overrides';
import MockFilesystem from '../data_sources/filedata/MockFilesystem';
import TestLogger, { LogLevel } from '../Logger';

const first = '/overrides/first.json';
const second = '/overrides/second.json';
const directory = '/overrides';

interface Snapshot {
  flags: LDKeyedFeatureStoreItem[];
  segments: LDKeyedFeatureStoreItem[];
}

class CapturingSink implements LDOverrideSink {
  public snapshots: Snapshot[] = [];

  setOverrides(flags: LDKeyedFeatureStoreItem[], segments: LDKeyedFeatureStoreItem[]): void {
    this.snapshots.push({ flags, segments });
  }

  get last(): Snapshot {
    return this.snapshots[this.snapshots.length - 1];
  }

  flagKeys(): string[] {
    return this.last.flags.map((flag) => flag.key).sort();
  }
}

// The Info lines that report the overrides in effect. The reloader logs other Info lines.
function infoLines(logger: TestLogger): string[] {
  return logger.getMessages(LogLevel.Info).filter((line) => line.startsWith('Flag overrides'));
}

describe('given a file override source over a mock filesystem', () => {
  let filesystem: MockFilesystem;
  let logger: TestLogger;
  let sink: CapturingSink;
  let source: FileOverrideSource;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    logger = new TestLogger();
    sink = new CapturingSink();
  });

  afterEach(() => {
    source?.close();
    jest.useRealTimers();
  });

  const startSource = async (config: Partial<FileOverrideSourceConfig> & { paths: string[] }) => {
    source = new FileOverrideSource(
      {
        duplicateKeysHandling: 'fail',
        changeDetection: 'polling',
        pollIntervalMs: 1000,
        ...config,
      },
      filesystem,
      logger,
    );
    await source.start(sink);
    return source;
  };

  it('loads the initial data before start completes', async () => {
    filesystem.set(
      first,
      '{"flagValues": {"flag1": true}, "flags": {"flag2": {"key": "flag2", "version": 3, "on": false}}}',
    );

    await startSource({ paths: [first] });

    expect(sink.snapshots).toHaveLength(1);
    expect(sink.flagKeys()).toEqual(['flag1', 'flag2']);
    // The flag value entry was expanded into a full flag definition that is off.
    const flag1 = sink.last.flags.find((flag) => flag.key === 'flag1')!;
    expect(flag1.variations).toEqual([true]);
    expect(flag1.on).toBe(false);
    expect(sink.last.flags.find((flag) => flag.key === 'flag2')!.version).toEqual(3);
  });

  it('loads YAML with the configured parser', async () => {
    const yamlParser = jest.fn(() => ({ flagValues: { flag1: true } }));
    filesystem.set('/overrides/overrides.yaml', 'flagValues:\n  flag1: true\n');

    await startSource({ paths: ['/overrides/overrides.yaml'], yamlParser });

    expect(yamlParser).toHaveBeenCalledTimes(1);
    expect(sink.flagKeys()).toEqual(['flag1']);
  });

  it('merges files in the configured order', async () => {
    filesystem.set(first, '{"flags": {"flag1": {"key": "flag1", "version": 1}}}');
    filesystem.set(second, '{"flags": {"flag1": {"key": "flag1", "version": 2}}}');

    await startSource({ paths: [first, second], duplicateKeysHandling: 'ignore' });

    expect(sink.snapshots).toHaveLength(1);
    expect(sink.last.flags).toHaveLength(1);
    expect(sink.last.flags[0].version).toEqual(1);
  });

  it('fails the load for duplicate keys by default', async () => {
    filesystem.set(first, '{"flags": {"flag1": {"key": "flag1", "version": 1}}}');
    filesystem.set(second, '{"flags": {"flag1": {"key": "flag1", "version": 2}}}');

    await startSource({ paths: [first, second] });
    await jest.advanceTimersByTimeAsync(200);

    expect(sink.snapshots).toHaveLength(0);
    logger.expectMessages([{ level: LogLevel.Error, matches: /specified by multiple files/ }]);
  });

  it('starts with a missing file and picks it up when it appears', async () => {
    await startSource({ paths: [first] });

    // A missing file contributes no overrides. The initial snapshot is empty.
    expect(sink.snapshots).toHaveLength(1);
    expect(sink.last.flags).toHaveLength(0);

    filesystem.set(first, '{"flagValues": {"flag1": true}}', 1);
    await jest.advanceTimersByTimeAsync(1100);
    expect(sink.snapshots).toHaveLength(2);
    expect(sink.flagKeys()).toEqual(['flag1']);
  });

  it('adds and removes the entries of a file as it appears and disappears', async () => {
    filesystem.set(first, '{"flagValues": {"from-first": true}}', 1);

    // Step 1: one configured file exists and one does not. The existing file applies.
    await startSource({ paths: [first, second] });
    expect(sink.flagKeys()).toEqual(['from-first']);

    // Step 2: the second file appears. Both apply.
    filesystem.set(second, '{"flagValues": {"from-second": true}}', 1);
    await jest.advanceTimersByTimeAsync(1100);
    expect(sink.flagKeys()).toEqual(['from-first', 'from-second']);

    // Step 3: the second file is deleted. Its overrides are removed.
    filesystem.remove(second);
    await jest.advanceTimersByTimeAsync(1100);
    expect(sink.flagKeys()).toEqual(['from-first']);

    // Step 4: the last file is deleted. The layer is cleared.
    filesystem.remove(first);
    await jest.advanceTimersByTimeAsync(1100);
    expect(sink.last.flags).toHaveLength(0);
    expect(sink.snapshots).toHaveLength(4);
  });

  it('logs the overrides in effect on each change', async () => {
    filesystem.set(
      first,
      '{"flagValues": {"flag1": true, "flag2": false}, "segments": {"seg": {"key": "seg", "version": 1}}}',
      1,
    );

    // Step 1: at startup, one file supplies entries and the other is absent.
    await startSource({ paths: [first, second] });
    expect(infoLines(logger)).toContain(
      `Flag overrides in effect: 2 flags, 1 segment (${first}: 2 flags, 1 segment; ${second}: absent)`,
    );

    // Step 2: the absent file appears with one entry.
    filesystem.set(second, '{"flagValues": {"flag3": true}}', 1);
    await jest.advanceTimersByTimeAsync(1100);
    expect(infoLines(logger)).toContain(
      `Flag overrides in effect: 3 flags, 1 segment (${first}: 2 flags, 1 segment; ${second}: 1 flag)`,
    );

    // Step 3: both files are deleted. Nothing is in effect.
    filesystem.remove(first);
    filesystem.remove(second);
    await jest.advanceTimersByTimeAsync(1100);
    expect(infoLines(logger)).toContain(
      `Flag overrides: none in effect (${first}: absent; ${second}: absent)`,
    );
  });

  it('logs a file with no entries', async () => {
    filesystem.set(first, '{}');
    await startSource({ paths: [first] });
    expect(infoLines(logger)).toContain(`Flag overrides: none in effect (${first}: no entries)`);
  });

  it('logs none in effect at startup without files', async () => {
    await startSource({ paths: [first] });
    expect(infoLines(logger)).toContain(`Flag overrides: none in effect (${first}: absent)`);
  });

  it('does not log an unchanged reload', async () => {
    filesystem.set(first, '{"flagValues": {"flag1": true}}', 1);
    await startSource({ paths: [first] });
    expect(infoLines(logger)).toHaveLength(1);

    // The poller sees a new modification time, but the content is the same.
    filesystem.set(first, '{"flagValues": {"flag1": true}}', 2);
    await jest.advanceTimersByTimeAsync(1100);
    expect(sink.snapshots).toHaveLength(1);
    expect(infoLines(logger)).toHaveLength(1);
  });

  it('is quiet in watching mode while the file is absent and loads it when it appears', async () => {
    await startSource({ paths: [first], changeDetection: 'watching' });
    expect(sink.snapshots).toHaveLength(1);
    expect(filesystem.activeWatches(directory)).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(2500);
    expect(logger.getCount(LogLevel.Error)).toEqual(0);
    expect(logger.getCount(LogLevel.Warn)).toEqual(0);

    filesystem.set(first, '{"flagValues": {"flag1": true}}');
    filesystem.emit(directory, 'rename');
    await jest.advanceTimersByTimeAsync(100);
    expect(sink.flagKeys()).toEqual(['flag1']);
  });

  it('reloads on a change in watching mode', async () => {
    filesystem.set(first, '{"flagValues": {"flag1": true}}');
    await startSource({ paths: [first], changeDetection: 'watching' });
    expect(sink.snapshots).toHaveLength(1);

    filesystem.set(first, '{"flagValues": {"flag1": true, "flag2": false}}');
    filesystem.emit(directory);
    await jest.advanceTimersByTimeAsync(100);
    expect(sink.flagKeys()).toEqual(['flag1', 'flag2']);

    // Removing entries removes them from the snapshot. A reload is a full replacement.
    filesystem.set(first, '{}');
    filesystem.emit(directory);
    await jest.advanceTimersByTimeAsync(100);
    expect(sink.last.flags).toHaveLength(0);
  });

  it('reloads on a change in polling mode', async () => {
    filesystem.set(first, '{"flagValues": {"flag1": true}}', 1);
    await startSource({ paths: [first], pollIntervalMs: 1000 });
    expect(sink.snapshots).toHaveLength(1);

    filesystem.set(first, '{"flagValues": {"flag1": true, "flag2": false}}', 2);
    // The poll tick at one second starts the debounced reload, which runs 100 ms later.
    await jest.advanceTimersByTimeAsync(1099);
    expect(sink.snapshots).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(sink.flagKeys()).toEqual(['flag1', 'flag2']);
  });

  it('keeps the last good overrides across a malformed edit and recovers', async () => {
    filesystem.set(first, '{"flagValues": {"flag1": true}}');
    await startSource({ paths: [first], changeDetection: 'watching' });
    expect(sink.snapshots).toHaveLength(1);

    // A malformed edit produces no snapshot. The previously applied overrides stay in effect
    // because the sink is never called.
    filesystem.set(first, '{"flagValues"');
    filesystem.emit(directory);
    await jest.advanceTimersByTimeAsync(300);
    expect(sink.snapshots).toHaveLength(1);
    logger.expectMessages([{ level: LogLevel.Error, matches: /Unable to load flags/ }]);

    // Fixing the file without a further notification recovers through the retry.
    filesystem.set(first, '{"flagValues": {"flag1": false}}');
    await jest.advanceTimersByTimeAsync(1000);
    expect(sink.snapshots).toHaveLength(2);
    expect(sink.last.flags[0].variations).toEqual([false]);
  });

  it('stops detecting changes when closed', async () => {
    filesystem.set(first, '{"flagValues": {"flag1": true}}', 1);
    await startSource({ paths: [first] });

    source.close();
    source.close();

    filesystem.set(first, '{"flagValues": {"flag1": false}}', 2);
    await jest.advanceTimersByTimeAsync(5000);
    expect(sink.snapshots).toHaveLength(1);
    expect(jest.getTimerCount()).toEqual(0);
  });

  it('closes its watches when closed', async () => {
    filesystem.set(first, '{"flagValues": {"flag1": true}}');
    await startSource({ paths: [first], changeDetection: 'watching' });
    expect(filesystem.activeWatches(directory)).toHaveLength(1);

    source.close();
    expect(filesystem.activeWatches(directory)).toHaveLength(0);
  });

  it('delivers nothing when closed before the initial load completes', async () => {
    filesystem.set(first, '{"flagValues": {"flag1": true}}');
    source = new FileOverrideSource(
      {
        paths: [first],
        duplicateKeysHandling: 'fail',
        changeDetection: 'polling',
        pollIntervalMs: 1000,
      },
      filesystem,
      logger,
    );

    const started = source.start(sink);
    source.close();
    await started;

    expect(sink.snapshots).toHaveLength(0);
    expect(jest.getTimerCount()).toEqual(0);
  });
});
