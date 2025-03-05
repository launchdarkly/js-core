import {
  LDFeatureStore,
  LDOptions as LDOptionsCommon,
  TypeValidator,
  TypeValidators,
} from '@launchdarkly/js-server-sdk-common';

/**
 * The Launchdarkly Fastly Compute SDK configuration options.
 */
export type FastlySDKOptions = Pick<LDOptionsCommon, 'logger' | 'sendEvents' | 'eventsUri'> & {
  /**
   * The Fastly Backend name to send LaunchDarkly events. Backends are configured using the Fastly service backend configuration. This option can be ignored if the `sendEvents` option is set to `false`. See [Fastly's Backend documentation](https://developer.fastly.com/reference/api/services/backend/) for more information. The default value is `launchdarkly`.
   */
  eventsBackendName?: string;
};

/**
 * The internal options include featureStore because that's how the LDClient
 * implementation expects it.
 */
export type LDOptionsInternal = FastlySDKOptions & Pick<LDOptionsCommon, 'featureStore'>;

const validators = {
  clientSideId: TypeValidators.String,
  featureStore: TypeValidators.ObjectOrFactory,
  logger: TypeValidators.Object,
};

const validateOptions = (clientSideId: string, options: LDOptionsInternal) => {
  const { eventsBackendName, featureStore, logger, sendEvents, ...rest } = options;
  if (!clientSideId || !validators.clientSideId.is(clientSideId)) {
    throw new Error('You must configure the client with a client-side id');
  }

  if (!featureStore || !validators.featureStore.is(featureStore)) {
    throw new Error('You must configure the client with a feature store');
  }

  if (!logger || !validators.logger.is(logger)) {
    throw new Error('You must configure the client with a logger');
  }

  if (JSON.stringify(rest) !== '{}') {
    throw new Error(`Invalid configuration: ${Object.keys(rest).toString()} not supported`);
  }

  return true;
};

export default validateOptions;
