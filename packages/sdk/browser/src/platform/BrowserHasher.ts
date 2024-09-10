import { Hasher } from '@launchdarkly/js-client-sdk-common';

export default class BrowserHasher implements Hasher {
  private data: string[] = [];
  private algorithm: string;
  constructor(
    private readonly webcrypto: Crypto,
    algorithm: string,
  ) {
    switch (algorithm) {
      case 'sha1':
        this.algorithm = 'SHA-1';
        break;
      case 'sha256':
        this.algorithm = 'SHA-256';
        break;
      default:
        throw new Error(`Algorithm is not supported ${algorithm}`);
    }
  }

  async asyncDigest(encoding: string): Promise<string> {
    const combinedData = this.data.join('');
    const encoded = new TextEncoder().encode(combinedData);
    const digestedBuffer = await this.webcrypto.subtle.digest(this.algorithm, encoded);
    switch (encoding) {
      case 'base64':
        return btoa(String.fromCharCode(...new Uint8Array(digestedBuffer)));
      case 'hex':
        // Convert the buffer to an array of uint8 values, then convert each of those to hex.
        // The map function on a Uint8Array directly only maps to other Uint8Arrays.
        return [...new Uint8Array(digestedBuffer)]
          .map((val) => val.toString(16).padStart(2, '0'))
          .join('');
      default:
        throw new Error(`Encoding is not supported ${encoding}`);
    }
  }

  update(data: string): Hasher {
    this.data.push(data);
    return this as Hasher;
  }
}
