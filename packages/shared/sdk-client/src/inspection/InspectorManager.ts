import { LDContext, LDLogger } from '@launchdarkly/js-sdk-common';

import { LDEvaluationDetail } from '../api';
import { LDInspection } from '../api/LDInspection';
import createSafeInspector from './createSafeInspector';
import { invalidInspector } from './messages';

const FLAG_USED_TYPE = 'flag-used';
const FLAG_DETAILS_CHANGED_TYPE = 'flag-details-changed';
const FLAG_DETAIL_CHANGED_TYPE = 'flag-detail-changed';
const IDENTITY_CHANGED_TYPE = 'client-identity-changed';

const VALID__TYPES = [
  FLAG_USED_TYPE,
  FLAG_DETAILS_CHANGED_TYPE,
  FLAG_DETAIL_CHANGED_TYPE,
  IDENTITY_CHANGED_TYPE,
];

function validateInspector(inspector: LDInspection, logger: LDLogger): boolean {
  const valid =
    VALID__TYPES.includes(inspector.type) &&
    inspector.method &&
    typeof inspector.method === 'function';

  if (!valid) {
    logger.warn(invalidInspector(inspector.type, inspector.name));
  }

  return valid;
}

/**
 * Manages dispatching of inspection data to registered inspectors.
 */
export default class InspectorManager {
  private _safeInspectors: LDInspection[] = [];

  constructor(inspectors: LDInspection[], logger: LDLogger) {
    const validInspectors = inspectors.filter((inspector) => validateInspector(inspector, logger));
    this._safeInspectors = validInspectors.map((inspector) =>
      createSafeInspector(inspector, logger),
    );
  }

  hasInspectors(): boolean {
    return this._safeInspectors.length !== 0;
  }

  /**
   * Notify registered inspectors of a flag being used.
   *
   * @param flagKey The key for the flag.
   * @param detail The LDEvaluationDetail for the flag.
   * @param context The LDContext for the flag.
   */
  onFlagUsed(flagKey: string, detail: LDEvaluationDetail, context?: LDContext) {
    this._safeInspectors.forEach((inspector) => {
      if (inspector.type === FLAG_USED_TYPE) {
        inspector.method(flagKey, detail, context);
      }
    });
  }

  /**
   * Notify registered inspectors that the flags have been replaced.
   *
   * @param flags The current flags as a Record<string, LDEvaluationDetail>.
   */
  onFlagsChanged(flags: Record<string, LDEvaluationDetail>) {
    this._safeInspectors.forEach((inspector) => {
      if (inspector.type === FLAG_DETAILS_CHANGED_TYPE) {
        inspector.method(flags);
      }
    });
  }

  /**
   * Notify registered inspectors that a flag value has changed.
   *
   * @param flagKey The key for the flag that changed.
   * @param flag An `LDEvaluationDetail` for the flag.
   */
  onFlagChanged(flagKey: string, flag: LDEvaluationDetail) {
    this._safeInspectors.forEach((inspector) => {
      if (inspector.type === FLAG_DETAIL_CHANGED_TYPE) {
        inspector.method(flagKey, flag);
      }
    });
  }

  /**
   * Notify the registered inspectors that the context identity has changed.
   *
   * The notification itself will be dispatched asynchronously.
   *
   * @param context The `LDContext` which is now identified.
   */
  onIdentityChanged(context: LDContext) {
    this._safeInspectors.forEach((inspector) => {
      if (inspector.type === IDENTITY_CHANGED_TYPE) {
        inspector.method(context);
      }
    });
  }
}
