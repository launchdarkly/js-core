import { LDContext } from '@launchdarkly/js-sdk-common';

import { LDEvaluationDetail } from './LDEvaluationDetail';

/**
 * Callback interface for collecting information about the SDK at runtime.
 *
 * This interface is used to collect information about flag usage.
 *
 * This interface should not be used by the application to access flags for the purpose of controlling application
 * flow. It is intended for monitoring, analytics, or debugging purposes.
 */
export interface LDInspectionFlagUsedHandler {
  type: 'flag-used';

  /**
   * Name of the inspector. Will be used for logging issues with the inspector.
   */
  name: string;

  /**
   * @deprecated All inspectors run synchronously. This field will be removed in a future major version.
   */
  synchronous?: boolean;

  /**
   * This method is called when a flag is accessed via a variation method, or it can be called based on actions in
   * wrapper SDKs which have different methods of tracking when a flag was accessed. It is not called when a call is made
   * to allFlags.
   */
  method: (flagKey: string, flagDetail: LDEvaluationDetail, context?: LDContext) => void;
}

/**
 * Callback interface for collecting information about the SDK at runtime.
 *
 * This interface is used to collect information about flag data. In order to understand the
 * current flag state it should be combined with {@link LDInspectionFlagValueChangedHandler}.
 * This interface will get the initial flag information, and
 * {@link LDInspectionFlagValueChangedHandler} will provide changes to individual flags.
 *
 * This interface should not be used by the application to access flags for the purpose of controlling application
 * flow. It is intended for monitoring, analytics, or debugging purposes.
 */
export interface LDInspectionFlagDetailsChangedHandler {
  type: 'flag-details-changed';

  /**
   * Name of the inspector. Will be used for logging issues with the inspector.
   */
  name: string;

  /**
   * @deprecated All inspectors run synchronously. This field will be removed in a future major version.
   */
  synchronous?: boolean;

  /**
   * This method is called when the flags in the store are replaced with new flags. It will contain all flags
   * regardless of if they have been evaluated.
   */
  method: (details: Record<string, LDEvaluationDetail>) => void;
}

/**
 * Callback interface for collecting information about the SDK at runtime.
 *
 * This interface is used to collect changes to flag data, but does not provide the initial
 * data. It can be combined with {@link LDInspectionFlagValuesChangedHandler} to track the
 * entire flag state.
 *
 * This interface should not be used by the application to access flags for the purpose of controlling application
 * flow. It is intended for monitoring, analytics, or debugging purposes.
 *
 * When a flag is deleted the `value` in the {@link LDEvaluationDetail} will be `undefined`.
 */
export interface LDInspectionFlagDetailChangedHandler {
  type: 'flag-detail-changed';

  /**
   * Name of the inspector. Will be used for logging issues with the inspector.
   */
  name: string;

  /**
   * @deprecated All inspectors run synchronously. This field will be removed in a future major version.
   */
  synchronous?: boolean;

  /**
   * This method is called when a flag is updated. It will not be called
   * when all flags are updated.
   */
  method: (flagKey: string, detail: LDEvaluationDetail) => void;
}

/**
 * Callback interface for collecting information about the SDK at runtime.
 *
 * This interface is used to track current identity state of the SDK.
 *
 * This interface should not be used by the application to access flags for the purpose of controlling application
 * flow. It is intended for monitoring, analytics, or debugging purposes.
 */
export interface LDInspectionIdentifyHandler {
  type: 'client-identity-changed';

  /**
   * Name of the inspector. Will be used for logging issues with the inspector.
   */
  name: string;

  /**
   * @deprecated All inspectors run synchronously. This field will be removed in a future major version.
   */
  synchronous?: boolean;

  /**
   * This method will be called when an identify operation completes.
   */
  method: (context: LDContext) => void;
}

export type LDInspection =
  | LDInspectionFlagUsedHandler
  | LDInspectionFlagDetailsChangedHandler
  | LDInspectionFlagDetailChangedHandler
  | LDInspectionIdentifyHandler;
