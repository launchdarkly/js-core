import { EventEmitter } from 'node:events';

import { internal } from '@launchdarkly/js-sdk-common';
import { Info, LDClientImpl, LDOptions } from '@launchdarkly/js-server-sdk-common';

import EdgePlatform from '../platform';
import createCallbacks from './createCallbacks';
import createOptions from './createOptions';

/**
 * The LaunchDarkly SDK edge client object.
 */
export class LDClient extends LDClientImpl {
  emitter: EventEmitter;

  // clientSideID is only used to query featureStore, not to initialize with LD servers
  constructor(clientSideID: string, platformInfo: Info, options: LDOptions) {
    const em = new EventEmitter();
    const platform = new EdgePlatform(platformInfo);
    const internalOptions: internal.LDInternalOptions = {
      analyticsEventPath: `/events/bulk/${clientSideID}`,
      diagnosticEventPath: `/events/diagnostic/${clientSideID}`,
      includeAuthorizationHeader: false,
    };
    super(clientSideID, platform, createOptions(options), createCallbacks(em), internalOptions);
    this.emitter = em;
  }
}

export default LDClient;
