/**
 * This is the API reference for the React Native LaunchDarkly SDK.
 *
 * For more information, see the SDK reference guide.
 *
 * @packageDocumentation
 */
import ReactNativeLDClient from './ReactNativeLDClient';
import RNOptions, { RNDataSystemOptions, RNStorage } from './RNOptions';

export * from './hooks';
export * from './LDPlugin';
export * from './provider';
export * from '@launchdarkly/js-client-sdk-common';

// Override the common type with a client specific one.
// TODO: we will remove this once we major version this SDK.
export type {
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
} from './hooks/variation/LDEvaluationDetail';

export { RNOptions as LDOptions, ReactNativeLDClient, RNDataSystemOptions, RNStorage };
