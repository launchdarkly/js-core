import { FileStats, Filesystem, WatchHandle } from '@launchdarkly/js-sdk-common';

interface MockFile {
  data: string;
  timestamp: number;
  size?: number;
}

export interface MockWatch {
  path: string;
  callback: (eventType: string, filename: string) => void;
  closed: boolean;
}

interface PendingRead {
  path: string;
  resolve: (data: string) => void;
  reject: (err: any) => void;
}

interface PendingStats {
  path: string;
  resolve: (stats: FileStats | undefined) => void;
}

function notFound(path: string): Error {
  const err = new Error(`ENOENT: no such file or directory, open '${path}'`) as Error & {
    code: string;
  };
  err.code = 'ENOENT';
  return err;
}

/**
 * An in-memory filesystem for the file data tests. Reads and metadata lookups can be deferred
 * so that a test can observe what happens while an operation is in progress.
 */
export default class MockFilesystem implements Filesystem {
  public files: Record<string, MockFile> = {};

  public watches: MockWatch[] = [];

  public failingDirectories = new Set<string>();

  public deferReads = false;

  public pendingReads: PendingRead[] = [];

  public deferStats = false;

  public pendingStats: PendingStats[] = [];

  public readCount = 0;

  public statsCount = 0;

  constructor(supportsStats: boolean = true) {
    if (!supportsStats) {
      // A platform without metadata support does not have the method at all.
      (this as any).getFileStats = undefined;
    }
  }

  set(path: string, data: string, timestamp: number = 0, size?: number) {
    this.files[path] = { data, timestamp, size };
  }

  remove(path: string) {
    delete this.files[path];
  }

  emit(path: string, eventType: string = 'change') {
    this.watches
      .filter((watch) => watch.path === path && !watch.closed)
      .forEach((watch) => watch.callback(eventType, path));
  }

  activeWatches(path?: string): MockWatch[] {
    return this.watches.filter((watch) => !watch.closed && (!path || watch.path === path));
  }

  /**
   * Completes every deferred read with the current file contents.
   */
  completePendingReads() {
    const pending = this.pendingReads;
    this.pendingReads = [];
    pending.forEach((read) => {
      const file = this.files[read.path];
      if (file) {
        read.resolve(file.data);
      } else {
        read.reject(notFound(read.path));
      }
    });
  }

  /**
   * Completes every deferred metadata lookup with the current file state.
   */
  completePendingStats() {
    const pending = this.pendingStats;
    this.pendingStats = [];
    pending.forEach((lookup) => lookup.resolve(this._statsOf(lookup.path)));
  }

  async getFileTimestamp(path: string): Promise<number> {
    const file = this.files[path];
    if (!file) {
      throw notFound(path);
    }
    return file.timestamp;
  }

  async readFile(path: string): Promise<string> {
    this.readCount += 1;
    if (this.deferReads) {
      return new Promise<string>((resolve, reject) => {
        this.pendingReads.push({ path, resolve, reject });
      });
    }
    const file = this.files[path];
    if (!file) {
      throw notFound(path);
    }
    return file.data;
  }

  async getFileStats(path: string): Promise<FileStats | undefined> {
    this.statsCount += 1;
    if (this.deferStats) {
      return new Promise<FileStats | undefined>((resolve) => {
        this.pendingStats.push({ path, resolve });
      });
    }
    return this._statsOf(path);
  }

  watch(path: string, callback: (eventType: string, filename: string) => void): WatchHandle {
    if (this.failingDirectories.has(path)) {
      throw new Error(`cannot watch ${path}`);
    }
    const watch: MockWatch = { path, callback, closed: false };
    this.watches.push(watch);
    return {
      close: () => {
        watch.closed = true;
      },
    };
  }

  private _statsOf(path: string): FileStats | undefined {
    const file = this.files[path];
    if (!file) {
      return undefined;
    }
    return { timestamp: file.timestamp, size: file.size ?? file.data.length };
  }
}
