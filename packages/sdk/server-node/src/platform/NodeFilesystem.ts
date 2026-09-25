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
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw err;
    }
  }

  watch(
    path: string,
    callback: (eventType: string, filename: string) => void,
  ): platform.WatchHandle {
    return fs.watch(path, { persistent: false }, (eventType) => {
      callback(eventType, path);
    });
  }
}
