import { LDLogger } from '@launchdarkly/js-sdk-common';
import { LDClientContext } from './api/options/LDClientContext';
import Configuration from './options/Configuration';
import ServiceEndpoints from './options/ServiceEndpoints';
import { Platform } from './platform';

interface BasicConfiguration {
  logger?: LDLogger;

  /**
   * True if the SDK was configured to be completely offline.
   */
  offline: boolean;

  /**
   * The configured SDK key.
   */
  sdkKey: string;

  /**
   * Defines the base service URIs used by SDK components.
   */
  serviceEndpoints: ServiceEndpoints;
}

/**
 * @internal
 */
export default class ClientContext implements LDClientContext {
  basicConfiguration: BasicConfiguration;

  constructor(
    sdkKey: string,
    configuration: Configuration,
    public readonly platform: Platform,
  ) {
    this.basicConfiguration = {
      logger: configuration.logger,
      offline: configuration.offline,
      sdkKey,
      serviceEndpoints: configuration.serviceEndpoints,
    };
  }
}
