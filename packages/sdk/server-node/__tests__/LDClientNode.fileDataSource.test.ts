import { integrations } from '@launchdarkly/js-server-sdk-common';
import * as fs from 'node:fs/promises';
import LDClientNode from '../src/LDClientNode';

const flag1Key = 'flag1';
const flag2Key = 'flag2';
const flag2Value = 'value2';
const segment1Key = 'seg1';

const flag1 = {
  key: flag1Key,
  on: true,
  rules: [
    { clauses: [{ op: 'segmentMatch', values: [segment1Key] }], variation: 1 },
  ],
  fallthrough: {
    variation: 2,
  },
  variations: ['fall', 'off', 'on'],
};

const segment1 = {
  key: segment1Key,
  included: ['user1'],
};

const flagOnlyJson = `
{
  "flags": {
    "${flag1Key}": ${JSON.stringify(flag1)}
  }
}`;

const segmentOnlyJson = `
{
  "segments": {
    "${segment1Key}": ${JSON.stringify(segment1)}
  }
}`;

const allPropertiesJson = `
{
  "flags": {
    "${flag1Key}": ${JSON.stringify(flag1)}
  },
  "flagValues": {
    "${flag2Key}": "${flag2Value}"
  },
  "segments": {
    "${segment1Key}": ${JSON.stringify(segment1)}
  }
}`;

const tmpFiles: string[] = [];

async function exists(path: string): Promise<boolean> {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

const tmpDir = './tmp_test';

async function makeTempFile(content: string): Promise<string> {
  const fileName = (Math.random() + 1).toString(36).substring(7);
  if (!await exists(tmpDir)) {
    await fs.mkdir(tmpDir);
  }
  const fullPath = `${tmpDir}/${fileName}`;
  await fs.writeFile(fullPath, content);
  tmpFiles.push(fullPath);
  return fullPath;
}

async function replaceFileContent(filePath: string, content: string) {
  return fs.writeFile(filePath, content);
}

// Filesystem operations can be slow in CI environments.
// This is outside a describe block because of: https://github.com/facebook/jest/issues/11543
jest.setTimeout(30000);

describe('When using a file data source', () => {
  afterAll(async () => {
    fs.rm(tmpDir, { recursive: true }).catch(() => {
      // Don't care.
    });
  });

  it('loads flags on start from JSON', async () => {
    const path = await makeTempFile(allPropertiesJson);
    const fds = new integrations.FileDataSourceFactory({
      paths: [path],
    });

    const client = new LDClientNode('sdk-key', {
      updateProcessor: fds.getFactory(),
      sendEvents: false,
    });

    await client.waitForInitialization();

    const f1Var = await client.variation(flag1Key, { key: 'user1' }, 'default');
    expect(f1Var).toEqual('off');
    const f1VarNoSeg = await client.variation(flag1Key, { key: 'user2' }, 'default');
    expect(f1VarNoSeg).toEqual('on');
    const f2Var = await client.variation(flag2Key, { key: 'user1' }, 'default');
    expect(f2Var).toEqual('value2');

    client.close();
  });

  it('it can load multiple files', async () => {
    const path1 = await makeTempFile(flagOnlyJson);
    const path2 = await makeTempFile(segmentOnlyJson);
    const fds = new integrations.FileDataSourceFactory({
      paths: [path1, path2],
    });

    const client = new LDClientNode('sdk-key', {
      updateProcessor: fds.getFactory(),
      sendEvents: false,
    });

    await client.waitForInitialization();

    const f1Var = await client.variation(flag1Key, { key: 'user1' }, 'default');
    expect(f1Var).toEqual('off');
    const f1VarNoSeg = await client.variation(flag1Key, { key: 'user2' }, 'default');
    expect(f1VarNoSeg).toEqual('on');

    client.close();
  });

  it('reloads the file if the content changes', async () => {
    const path = await makeTempFile(allPropertiesJson);
    const fds = new integrations.FileDataSourceFactory({
      paths: [path],
      autoUpdate: true,
    });

    const client = new LDClientNode('sdk-key', {
      updateProcessor: fds.getFactory(),
      sendEvents: false,
    });

    await client.waitForInitialization();

    const f1Var = await client.variation(flag1Key, { key: 'user1' }, 'default');
    expect(f1Var).toEqual('off');
    const f1VarNoSeg = await client.variation(flag1Key, { key: 'user2' }, 'default');
    expect(f1VarNoSeg).toEqual('on');
    const f2Var = await client.variation(flag2Key, { key: 'user1' }, 'default');
    expect(f2Var).toEqual('value2');

    await replaceFileContent(path, flagOnlyJson);

    await new Promise<void>((resolve) => {
      client.once('update', async () => {
        // After the file reloads we get changes, so we know we can move onto
        // evaluation.
        await replaceFileContent(path, flagOnlyJson);
        resolve();
      });
    });

    const f1VarB = await client.variation(flag1Key, { key: 'user1' }, 'default');
    expect(f1VarB).toEqual('on'); // Segment doesn't exist anymore.
    const f1VarNoSegB = await client.variation(flag1Key, { key: 'user2' }, 'default');
    expect(f1VarNoSegB).toEqual('on');
    const f2VarB = await client.variation(flag2Key, { key: 'user1' }, 'default');
    expect(f2VarB).toEqual('default');

    client.close();
  });
});
