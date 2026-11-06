import CryptoJSHasher from '../../../src/platform/crypto/cryptoJSHasher';
import CryptoJSHmac from '../../../src/platform/crypto/cryptoJSHmac';
import { SupportedHashAlgorithm } from '../../../src/platform/crypto/types';

const vectors = [
  {
    algorithm: 'sha1',
    hashHex: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
    hashBase64: 'qvTGHdzF6KLavt4PO0gs2a6pQ00=',
    hmacHex: 'b34ceac4516ff23a143e61d79d0fa7a4fbe5f266',
    hmacBase64: 's0zqxFFv8joUPmHXnQ+npPvl8mY=',
  },
  {
    algorithm: 'sha256',
    hashHex: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    hashBase64: 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=',
    hmacHex: '9307b3b915efb5171ff14d8cb55fbcc798c6c0ef1456d66ded1a6aa723a58b7b',
    hmacBase64: 'kwezuRXvtRcf8U2MtV+8x5jGwO8UVtZt7RpqpyOli3s=',
  },
] as const;

describe.each(vectors)('given the $algorithm algorithm', (vector) => {
  const algorithm = vector.algorithm as SupportedHashAlgorithm;

  it('hashes using hex encoding', () => {
    expect(new CryptoJSHasher(algorithm).update('hello').digest('hex')).toEqual(vector.hashHex);
  });

  it('hashes using base64 encoding', () => {
    expect(new CryptoJSHasher(algorithm).update('hello').digest('base64')).toEqual(
      vector.hashBase64,
    );
  });

  it('creates an HMAC using hex encoding', () => {
    expect(new CryptoJSHmac(algorithm, 'key').update('hello').digest('hex')).toEqual(
      vector.hmacHex,
    );
  });

  it('creates an HMAC using base64 encoding', () => {
    expect(new CryptoJSHmac(algorithm, 'key').update('hello').digest('base64')).toEqual(
      vector.hmacBase64,
    );
  });
});
