/**
 * This is the API reference for the React Native LaunchDarkly SDK.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import ReactNativeLDClient from './ReactNativeLDClient';
import RNOptions, { RNDataSystemOptions, RNStorage } from './RNOptions';

export * from '@launchdarkly/js-client-sdk-common';

// Override the common LDClient type with a React Native-specific one that
// preserves backward-compatible identify() returning Promise<void>.
export type { LDClient } from './LDClient';

export * from './hooks';
export * from './provider';
export * from './LDPlugin';

// Override the common type with a client specific one.
// TODO: we will remove this once we major version this SDK.
export type {
  LDEvaluationDetailTyped,
  LDEvaluationDetail,
} from './hooks/variation/LDEvaluationDetail';

export { ReactNativeLDClient, RNOptions as LDOptions, RNDataSystemOptions, RNStorage };
