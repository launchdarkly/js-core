import { AttributeReference, Context, Crypto } from '@launchdarkly/js-sdk-common';

/**
 * Bucketing can be done by string or integer values. The need to be converted to a string
 * for the hashing process.
 * @param value The value to get a bucketable value for.
 * @returns The value as a string, or null if the value cannot be used for bucketing.
 */
function valueForBucketing(value: any): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return null;
}

export default class Bucketer {
  private _crypto: Crypto;

  constructor(crypto: Crypto) {
    this._crypto = crypto;
  }

  private _sha1Hex(value: string) {
    const hash = this._crypto.createHash('sha1');
    hash.update(value);
    if (!hash.digest) {
      // This represents an error in platform implementation.
      throw new Error('Platform must implement digest or asyncDigest');
    }
    return hash.digest('hex');
  }

  /**
   * Bucket the provided context using the provided parameters.
   * @param context The context to bucket. Can be a 'multi' kind context, but
   * the bucketing will be by a specific contained kind.
   * @param key A key to use in hashing. Typically the flag key or the segment key.
   * @param attr The attribute to use for bucketing.
   * @param salt A salt to use in hashing.
   * @param kindForRollout The kind to use for bucketing.
   * @param seed A seed to use in hashing.
   *
   * @returns A tuple where the first value is the bucket, and the second value indicates if there
   * was a context for the value specified by `kindForRollout`. If there was not a context for the
   * specified kind, then the `inExperiment` attribute should be `false`.
   */
  bucket(
    context: Context,
    key: string,
    attr: AttributeReference,
    salt: string,
    kindForRollout: string = 'user',
    seed?: number,
  ): [number, boolean] {
    const value = context.valueForKind(attr, kindForRollout);
    const bucketableValue = valueForBucketing(value);

    // Bucketing cannot be done by the specified attribute value.
    if (bucketableValue === null) {
      // If we got a value, then we know there was a context, but if we didn't get a value, then
      // it could either be there wasn't an attribute, the attribute was undefined/null, or there
      // was not a context. So here check for the context.
      const hadContext = context.kinds.indexOf(kindForRollout) >= 0;
      return [0, hadContext];
    }

    const prefix = seed ? Number(seed) : `${key}.${salt}`;
    const hashKey = `${prefix}.${bucketableValue}`;
    const hashVal = parseInt(this._sha1Hex(hashKey).substring(0, 15), 16);

    // This is how this has worked in previous implementations, but it is not
    // ideal.
    // The maximum safe integer representation in JS is 2^53 - 1.
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    return [hashVal / 0xfffffffffffffff, true];
  }
}
