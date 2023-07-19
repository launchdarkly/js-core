import { LDLogger, LDClientContext, Platform } from '../api';
import ServiceEndpoints from './ServiceEndpoints';

/**
 * Basic configuration applicable to many SDK components for both server and
 * client SDKs.
 */
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
 * The client context provides basic configuration and platform support which are required
 * when building SDK components.
 */
export default class ClientContext implements LDClientContext {
  basicConfiguration: BasicConfiguration;

  constructor(
    sdkKey: string,
    configuration: {
      logger?: LDLogger;
      offline: boolean;
      serviceEndpoints: ServiceEndpoints;
    },
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
