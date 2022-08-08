import { LDBasicConfiguration, LDClientContext } from './api/options/LDClientContext';
import Configuration from './options/Configuration';
import { Platform } from './platform';

/**
 * @internal
 */
export default class ClientContext implements LDClientContext {
  basicConfiguration: LDBasicConfiguration;

  constructor(
    sdkKey: string,
    configuration: Configuration,
    public readonly platform: Platform
  ) {
    this.basicConfiguration = {
      logger: configuration.logger,
      offline: configuration.offline,
      sdkKey,
      serviceEndpoints: configuration.serviceEndpoints
    };
  }
}
