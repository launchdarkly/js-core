// TextEncoder should be part of jsdom, but it is not. So we can import it from node in the tests.
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';

import BrowserHasher from '../../src/platform/BrowserHasher';

global.TextEncoder = TextEncoder;

// Crypto is injectable as it is also not correctly available with the combination of node and jsdom.

/**
 * The links below are different from js-sha256 and are useful to verify the
 * correctness of hash and encoding output:
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

  test('unsupported hash algorithm', async () => {
    expect(() => {
      // @ts-ignore
      // eslint-disable-next-line no-new
      new BrowserHasher(webcrypto, 'sha1');
    }).toThrow(/unsupported/i);
  });

  test('unsupported output algorithm', async () => {
    expect(async () => {
      // @ts-ignore
      const h = new BrowserHasher(webcrypto, 'sha256');
      h.update('test-app-id');
      await h.asyncDigest('base122');
    }).toThrow(/unsupported/i);
  });
});
