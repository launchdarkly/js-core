import { FilePoller } from '../../../src/data_sources/filedata';
import MockFilesystem from './MockFilesystem';

const interval = 5;
const path = '/data/one.json';
const path2 = '/data/two.json';

describe('given a poller over a mock filesystem', () => {
  let filesystem: MockFilesystem;
  let onChange: jest.Mock;
  let poller: FilePoller;

  beforeEach(() => {
    jest.useFakeTimers();
    filesystem = new MockFilesystem();
    onChange = jest.fn();
  });

  afterEach(() => {
    poller?.close();
    jest.useRealTimers();
  });

  const startPoller = async (paths: string[] = [path], fs: MockFilesystem = filesystem) => {
    poller = new FilePoller(fs, paths, interval, onChange);
    await poller.start();
    return poller;
  };

  it('does not report a change when nothing changed', async () => {
    filesystem.set(path, 'one', 1);
    await startPoller();

    await jest.advanceTimersByTimeAsync(interval * 20);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('detects a modification', async () => {
    filesystem.set(path, 'one', 1);
    await startPoller();

    filesystem.set(path, 'two!', 2);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('detects a same size rewrite with a new modification time', async () => {
    filesystem.set(path, 'one', 1);
    await startPoller();

    filesystem.set(path, 'two', 2);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('detects a size change with the same modification time', async () => {
    filesystem.set(path, 'one', 1);
    await startPoller();

    filesystem.set(path, 'four', 1);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('falls back to modification times when the platform has no file metadata', async () => {
    const fs = new MockFilesystem(false);
    expect(fs.getFileStats).toBeUndefined();
    fs.set(path, 'one', 1);
    await startPoller([path], fs);

    // A size change alone is not visible without metadata.
    fs.set(path, 'four', 1);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).not.toHaveBeenCalled();

    fs.set(path, 'four', 2);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);

    fs.remove(path);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('fires once per change', async () => {
    filesystem.set(path, 'one', 1);
    await startPoller();

    filesystem.set(path, 'two!', 2);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(interval * 20);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('detects a file appearing', async () => {
    await startPoller();

    await jest.advanceTimersByTimeAsync(interval * 20);
    expect(onChange).not.toHaveBeenCalled();

    filesystem.set(path, 'created', 1);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('detects a file disappearing', async () => {
    filesystem.set(path, 'content', 1);
    await startPoller();

    filesystem.remove(path);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('watches all files', async () => {
    filesystem.set(path, 'one', 1);
    filesystem.set(path2, 'two', 1);
    await startPoller([path, path2]);

    filesystem.set(path2, 'two-changed', 2);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('detects a change to the first of multiple files', async () => {
    filesystem.set(path, 'one', 1);
    filesystem.set(path2, 'two', 1);
    await startPoller([path, path2]);

    filesystem.set(path, 'one-changed', 2);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports one change when several files change in the same interval', async () => {
    filesystem.set(path, 'one', 1);
    filesystem.set(path2, 'two', 1);
    await startPoller([path, path2]);

    filesystem.set(path, 'one-changed', 2);
    filesystem.set(path2, 'two-changed', 2);
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stops on close', async () => {
    filesystem.set(path, 'one', 1);
    await startPoller();

    poller.close();
    poller.close();

    filesystem.set(path, 'two!', 2);
    await jest.advanceTimersByTimeAsync(interval * 20);
    expect(onChange).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toEqual(0);
  });

  it('does not invoke the callback for an examination that completes after close', async () => {
    filesystem.set(path, 'one', 1);
    await startPoller();

    filesystem.deferStats = true;
    await jest.advanceTimersByTimeAsync(interval);
    expect(filesystem.pendingStats).toHaveLength(1);

    poller.close();
    filesystem.set(path, 'two!', 2);
    filesystem.completePendingStats();
    await jest.advanceTimersByTimeAsync(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not start a new examination while one is in progress', async () => {
    filesystem.set(path, 'one', 1);
    await startPoller();
    const countAfterStart = filesystem.statsCount;

    filesystem.deferStats = true;
    await jest.advanceTimersByTimeAsync(interval * 5);
    expect(filesystem.statsCount).toEqual(countAfterStart + 1);

    filesystem.deferStats = false;
    filesystem.set(path, 'two!', 2);
    filesystem.completePendingStats();
    await jest.advanceTimersByTimeAsync(0);
    // The completed examination saw the original state. The next one sees the change.
    await jest.advanceTimersByTimeAsync(interval);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
