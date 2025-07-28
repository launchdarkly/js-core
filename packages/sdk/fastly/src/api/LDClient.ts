import { Info, internal, LDClientImpl } from '@launchdarkly/js-server-sdk-common';

import EdgePlatform from '../platform';
import { FastlySDKOptions } from '../utils/validateOptions';
import createCallbacks from './createCallbacks';
import createOptions from './createOptions';

export const DEFAULT_EVENTS_BACKEND_NAME = 'launchdarkly';

/**
 * The LaunchDarkly SDK edge client object.
 */
export default class LDClient extends LDClientImpl {
  private _isInitialized: boolean = false;

  // clientSideID is only used to query the edge key-value store and send analytics, not to initialize with LD servers
  constructor(clientSideID: string, platformInfo: Info, options: FastlySDKOptions) {
    const { eventsBackendName, ...ldOptions } = options;
    const platform = new EdgePlatform(
      platformInfo,
      eventsBackendName || DEFAULT_EVENTS_BACKEND_NAME,
    );
    const internalOptions: internal.LDInternalOptions = {
      analyticsEventPath: `/events/bulk/${clientSideID}`,
      diagnosticEventPath: `/events/diagnostic/${clientSideID}`,
      includeAuthorizationHeader: false,
    };

    const finalOptions = createOptions(ldOptions);

    super(clientSideID, platform, finalOptions, createCallbacks(), internalOptions);
  }

  override initialized(): boolean {
    return this._isInitialized;
  }

  override async waitForInitialization(): Promise<LDClient> {
    if (this._isInitialized) {
      return Promise.resolve(this);
    }

    return new Promise((resolve) => {
      // Check if the feature store has data
      (this as any)._featureStore.initialized((storeInitialized: boolean) => {
        if (storeInitialized) {
          this._isInitialized = true;
          resolve(this);
        }
      });
    });
  }
}
