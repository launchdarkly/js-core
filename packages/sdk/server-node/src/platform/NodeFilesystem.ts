import * as fs from 'fs';

import { platform } from '@launchdarkly/js-server-sdk-common';

const fsPromises = fs.promises;

export default class NodeFilesystem implements platform.Filesystem {
  async getFileTimestamp(path: string): Promise<number> {
    const stat = await fsPromises.stat(path);
    return stat.mtimeMs;
  }

  async readFile(path: string): Promise<string> {
    return fsPromises.readFile(path, 'utf8');
  }

  async getFileStats(path: string): Promise<platform.FileStats | undefined> {
    try {
      const stat = await fsPromises.stat(path);
      return { timestamp: stat.mtimeMs, size: stat.size };
    } catch (err) {
      // A path that uses a regular file as a directory names nothing. Windows reports it as a
      // missing path, so it is absent on every platform.
      const { code } = err as NodeJS.ErrnoException;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return undefined;
      }
      throw err;
    }
  }

  watch(
    path: string,
    callback: (eventType: string, filename: string) => void,
  ): platform.WatchHandle {
    const watcher = fs.watch(path, { persistent: false }, (eventType) => {
      callback(eventType, path);
    });
    // A watcher that emits an error with no listener raises an uncaught exception. Report the
    // failure through the callback instead, so the owner can set the watch up again.
    watcher.on('error', () => {
      callback('error', path);
    });
    return watcher;
  }
}
