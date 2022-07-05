import { Context } from '@launchdarkly/js-sdk-common';
import AttributeReference from '@launchdarkly/js-sdk-common/dist/AttributeReference';
import { Crypto } from '../platform';

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
  private crypto: Crypto;

  constructor(crypto: Crypto) {
    this.crypto = crypto;
  }

  private sha1Hex(value: string) {
    const hash = this.crypto.createHash('sha1');
    hash.update(value);
    return hash.digest('hex');
  }

  /**
   * Bucket the provided context using the provided parameters.
   * @param context The context to bucket. Can be a 'multi' kind context, but
   * the bucketing will be by a specific contained kind.
   * @param key A key to use in hashing. Typically the flag key or the segment key.
   * @param attr The attribute to use for bucketing.
   * @param salt A salt to use in hashing.
   * @param isExperiment Indicates if this rollout is an experiment. If it is, then the secondary
   * key will not be used.
   * @param kindForRollout The kind to use for bucketing.
   * @param seed A seed to use in hashing.
   */
  bucket(
    context: Context,
    key: string,
    attr: AttributeReference,
    salt: string,
    isExperiment: boolean,
    kindForRollout: string = 'user',
    seed?: number,
  ): number {
    const value = context.valueForKind(attr, kindForRollout);
    const bucketableValue = valueForBucketing(value);

    // Bucketing cannot be done by the specified attribute value.
    if (bucketableValue === null) {
      return 0;
    }

    const secondary = context.secondary(kindForRollout) ?? null;
    const useSecondary = secondary !== null && !isExperiment;

    const prefix = seed ? Number(seed) : `${key}.${salt}`;
    const hashKey = `${prefix}.${bucketableValue}${useSecondary ? `.${secondary}` : ''}`;
    const hashVal = parseInt(this.sha1Hex(hashKey).substring(0, 15), 16);

    // This is how this has worked in previous implementations, but it is not
    // ideal.
    // The maximum safe integer representation in JS is 2^53 - 1.
    // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
    return hashVal / 0xfffffffffffffff;
  }
}
