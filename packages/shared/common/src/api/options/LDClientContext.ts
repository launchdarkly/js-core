import { LDLogger } from '../logging';
import { Platform } from '../platform';

/**
 * Specifies the base service URIs used by SDK components.
 */
export interface LDServiceEndpoints {
  // Properties are for internal SDK components.
}

/**
 * The most basic properties of the SDK client that are available to all SDK component factories.
 */
export interface LDBasicConfiguration {
  logger?: LDLogger;

  /**
   * True if the SDK was configured to be completely offline.
   */
  offline?: boolean;

  /**
   * The configured SDK key.
   */
  sdkKey: string;

  /**
   * Defines the base service URIs used by SDK components.
   */
  serviceEndpoints: LDServiceEndpoints;
}

/**
 * Factory methods receive this class as a parameter.
 *
 * Its public properties provide information about the SDK configuration and environment. The SDK
 * may also include non-public properties that are relevant only when creating one of the built-in
 * component types and are not accessible to custom components.
 */
export interface LDClientContext {
  /**
   * The SDK's basic global properties.
   */
  basicConfiguration: LDBasicConfiguration;

  /**
   * Interfaces providing platform specific information and functionality.
   */
  platform: Platform;
}
