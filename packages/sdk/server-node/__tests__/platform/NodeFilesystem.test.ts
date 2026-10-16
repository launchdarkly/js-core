import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import NodeFilesystem from '../../src/platform/NodeFilesystem';

describe('given a temporary directory', () => {
  let directory: string;
  const filesystem = new NodeFilesystem();

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'node-filesystem-test-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('reports the modification time and size of an existing file', async () => {
    const filePath = path.join(directory, 'data.json');
    fs.writeFileSync(filePath, '{"a": 1}');
    const expected = fs.statSync(filePath);

    const stats = await filesystem.getFileStats(filePath);

    expect(stats).toEqual({ timestamp: expected.mtimeMs, size: 8 });
    expect(stats?.timestamp).toEqual(await filesystem.getFileTimestamp(filePath));
  });

  it('reports a file that does not exist as undefined', async () => {
    const stats = await filesystem.getFileStats(path.join(directory, 'missing.json'));
    expect(stats).toBeUndefined();
  });

  it('reports a path that uses a regular file as a directory as undefined', async () => {
    const filePath = path.join(directory, 'data.json');
    fs.writeFileSync(filePath, '{}');

    // POSIX platforms report this with a different code than a missing path. Windows reports
    // it as missing. Both mean that nothing is there.
    const stats = await filesystem.getFileStats(path.join(filePath, 'child.json'));
    expect(stats).toBeUndefined();
  });

  // A permission failure needs POSIX permissions and a user that they apply to.
  const canRestrictPermissions = process.platform !== 'win32' && process.getuid?.() !== 0;
  (canRestrictPermissions ? it : it.skip)(
    'rejects for a failure other than a missing path',
    async () => {
      const restricted = path.join(directory, 'restricted');
      fs.mkdirSync(restricted, { mode: 0o000 });
      try {
        await expect(filesystem.getFileStats(path.join(restricted, 'child.json'))).rejects.toThrow(
          /EACCES/,
        );
      } finally {
        fs.chmodSync(restricted, 0o700);
      }
    },
  );

  it('reports the name of the changed entry when the platform provides it', () => {
    const callback = jest.fn();
    const handle = filesystem.watch(directory, callback);
    try {
      // The FSWatcher 'change' event carries the event type and the entry name.
      (handle as fs.FSWatcher).emit('change', 'change', 'data.json');
      expect(callback).toHaveBeenCalledWith('change', directory, 'data.json');
      // Some platforms do not report which entry changed.
      (handle as fs.FSWatcher).emit('change', 'rename', null);
      expect(callback).toHaveBeenCalledWith('rename', directory, undefined);
    } finally {
      handle.close();
    }
  });

  it('reports a watch error through the callback', () => {
    const callback = jest.fn();
    const handle = filesystem.watch(directory, callback);
    try {
      // An error event on a watcher without a listener is an uncaught exception.
      expect(() => (handle as fs.FSWatcher).emit('error', new Error('watch failed'))).not.toThrow();
      expect(callback).toHaveBeenCalledWith('error', directory);
    } finally {
      handle.close();
    }
  });
});
