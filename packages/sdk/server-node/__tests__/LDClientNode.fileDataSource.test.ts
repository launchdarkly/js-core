import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { integrations } from '@launchdarkly/js-server-sdk-common';

import LDClientNode from '../src/LDClientNode';
import { rewriteInPlace, sampleValues } from './inPlaceWrites';
import waitFor from './waitFor';

const flag1Key = 'flag1';
const flag2Key = 'flag2';
const flag2Value = 'value2';
const segment1Key = 'seg1';

const flag1 = {
  key: flag1Key,
  on: true,
  rules: [{ clauses: [{ op: 'segmentMatch', values: [segment1Key] }], variation: 1 }],
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
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const tmpDir = './tmp_test';

async function makeTempFile(content: string): Promise<string> {
  const fileName = (Math.random() + 1).toString(36).substring(7);
  if (!(await exists(tmpDir))) {
    await mkdir(tmpDir);
  }
  const fullPath = `${tmpDir}/${fileName}`;
  await writeFile(fullPath, content);
  tmpFiles.push(fullPath);
  return fullPath;
}

async function replaceFileContent(filePath: string, content: string) {
  return writeFile(filePath, content);
}

describe('When using a file data source', () => {
  afterAll(async () => {
    await rm(tmpDir, { recursive: true }).catch(() => {
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

    await client.waitForInitialization({ timeout: 10 });

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

    await client.waitForInitialization({ timeout: 10 });

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

    await client.waitForInitialization({ timeout: 10 });

    const f1Var = await client.variation(flag1Key, { key: 'user1' }, 'default');
    expect(f1Var).toEqual('off');
    const f1VarNoSeg = await client.variation(flag1Key, { key: 'user2' }, 'default');
    expect(f1VarNoSeg).toEqual('on');
    const f2Var = await client.variation(flag2Key, { key: 'user1' }, 'default');
    expect(f2Var).toEqual('value2');

    const updatePromise = new Promise<void>((resolve) => {
      client.once('update', async () => {
        // After the file reloads we get changes, so we know we can move onto
        // evaluation.
        resolve();
      });
    });

    // Introduce a little delay so the file timestamp changes.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
    await replaceFileContent(path, flagOnlyJson);

    await updatePromise;

    const f1VarB = await client.variation(flag1Key, { key: 'user1' }, 'default');
    expect(f1VarB).toEqual('on'); // Segment doesn't exist anymore.
    const f1VarNoSegB = await client.variation(flag1Key, { key: 'user2' }, 'default');
    expect(f1VarNoSegB).toEqual('on');
    const f2VarB = await client.variation(flag2Key, { key: 'user1' }, 'default');
    expect(f2VarB).toEqual('default');

    client.close();
  });
});

describe('given a file data source that reloads a file rewritten in place', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ld-file-data-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it.each(['json', 'yaml'])('never serves the emptied %s file', async (extension) => {
    // The file is empty for 300 ms, longer than the settle window after a change, so a reload
    // reads it empty. The client must keep serving the old value until the new one is written.
    const path = join(directory, `flags.${extension}`);
    await writeFile(path, JSON.stringify({ flagValues: { flag1: 'a' } })); // JSON is also YAML
    const errors: string[] = [];
    const fds = new integrations.FileDataSourceFactory({
      paths: [path],
      autoUpdate: true,
      yamlParser: parseYaml,
    });
    const client = new LDClientNode('sdk-key', {
      updateProcessor: fds.getFactory(),
      sendEvents: false,
      diagnosticOptOut: true,
      logger: {
        error: (message: string) => errors.push(message),
        warn: () => {},
        info: () => {},
        debug: () => {},
      },
    });
    try {
      await client.waitForInitialization({ timeout: 10 });
      expect(await client.variation('flag1', { key: 'user1' }, 'default')).toEqual('a');

      const sampler = sampleValues(() => client.variation('flag1', { key: 'user1' }, 'default'));
      try {
        await rewriteInPlace(path, JSON.stringify({ flagValues: { flag1: 'b' } }), 300);
        // Waits for the sampler itself to see the new value, so it has recorded everything that
        // the client served before it.
        await waitFor(() => sampler.served.includes('b'), 10000);
      } finally {
        await sampler.stop();
      }

      expect(sampler.served).toEqual(['a', 'b']);
      // The file was read while it was empty, which is not an error to report.
      expect(errors).toEqual([]);
    } finally {
      client.close();
    }
  });
});
