import { webcrypto } from 'node:crypto';

import BrowserHasher from '../../src/platform/BrowserHasher';

// Crypto is injectable as it is also not correctly available with the combination of node and jsdom.

/**
 * Test vectors generated using.
 * https://www.liavaag.org/English/SHA-Generator/
 */
describe('PlatformHasher', () => {
  test('sha256 produces correct base64 output', async () => {
    // @ts-ignore
    const h = new BrowserHasher(webcrypto, 'sha256');

    h.update('test-app-id');
    const output = await h.asyncDigest('base64');

    expect(output).toEqual('XVm6ZNk6ejx6+IVtL7zfwYwRQ2/ck9+y7FaN32EcudQ=');
  });

  test('sha256 produces correct hex output', async () => {
    // @ts-ignore
    const h = new BrowserHasher(webcrypto, 'sha256');

    h.update('test-app-id');
    const output = await h.asyncDigest('hex');

    expect(output).toEqual('5d59ba64d93a7a3c7af8856d2fbcdfc18c11436fdc93dfb2ec568ddf611cb9d4');
  });

  test('sha1 produces correct base64 output', async () => {
    // @ts-ignore
    const h = new BrowserHasher(webcrypto, 'sha1');

    h.update('test-app-id');
    const output = await h.asyncDigest('base64');

    expect(output).toEqual('kydC7cRd9+LWbu4Ss/t1FiFmDcs=');
  });

  test('sha1 produces correct hex output', async () => {
    // @ts-ignore
    const h = new BrowserHasher(webcrypto, 'sha1');

    h.update('test-app-id');
    const output = await h.asyncDigest('hex');

    expect(output).toEqual('932742edc45df7e2d66eee12b3fb751621660dcb');
  });

  test('unsupported hash algorithm', async () => {
    expect(() => {
      // @ts-ignore
      // eslint-disable-next-line no-new
      new BrowserHasher(webcrypto, 'sha512');
    }).toThrow(/Algorithm is not supported/i);
  });

  test('unsupported output algorithm', async () => {
    await expect(async () => {
      // @ts-ignore
      const h = new BrowserHasher(webcrypto, 'sha256');
      h.update('test-app-id');
      await h.asyncDigest('base122');
    }).rejects.toThrow(/Encoding is not supported/i);
  });
});
