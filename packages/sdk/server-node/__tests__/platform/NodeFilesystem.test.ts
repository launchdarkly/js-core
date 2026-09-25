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

  it('rejects for a failure other than a missing file', async () => {
    const filePath = path.join(directory, 'data.json');
    fs.writeFileSync(filePath, '{}');

    // A path that treats a regular file as a directory fails with a different error.
    await expect(filesystem.getFileStats(path.join(filePath, 'child.json'))).rejects.toThrow(
      /ENOTDIR/,
    );
  });
});
