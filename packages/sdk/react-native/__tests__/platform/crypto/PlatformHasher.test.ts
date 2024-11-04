import PlatformHasher from '../../../src/platform/crypto/PlatformHasher';

/**
 * The links below are different from js-sha256 and are useful to verify the
 * correctness of hash and encoding output:
 * https://www.liavaag.org/English/SHA-Generator/
 * https://www.liavaag.org/English/SHA-Generator/HMAC/
 */
describe('PlatformHasher', () => {
  test('sha256 produces correct base64 output', () => {
    const h = new PlatformHasher('sha256');

    h.update('test-app-id');
    const output = h.digest('base64');

    expect(output).toEqual('XVm6ZNk6ejx6+IVtL7zfwYwRQ2/ck9+y7FaN32EcudQ=');
  });

  test('sha256 produces correct hex output', () => {
    const h = new PlatformHasher('sha256');

    h.update('test-app-id');
    const output = h.digest('hex');

    expect(output).toEqual('5d59ba64d93a7a3c7af8856d2fbcdfc18c11436fdc93dfb2ec568ddf611cb9d4');
  });

  test('unsupported hash algorithm', () => {
    expect(() => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const h = new PlatformHasher('sha1');
    }).toThrow(/unsupported/i);
  });

  test('unsupported output algorithm', () => {
    expect(() => {
      const h = new PlatformHasher('sha256');
      h.update('test-app-id');
      // @ts-ignore
      h.digest('base122');
    }).toThrow(/unsupported/i);
  });

  test('hmac produces correct base64 output', () => {
    const h = new PlatformHasher('sha256', 'hmac-key');

    h.update('test-app-id');
    const output = h.digest('base64');

    expect(output).toEqual('tB+++rKY29eF480Oe3ekuWk4AbXV2E8cTgk+UEB9xfA=');
  });

  test('hmac produces correct hex output', () => {
    const h = new PlatformHasher('sha256', 'hmac-key');

    h.update('test-app-id');
    const output = h.digest('hex');

    expect(output).toEqual('b41fbefab298dbd785e3cd0e7b77a4b9693801b5d5d84f1c4e093e50407dc5f0');
  });
});
