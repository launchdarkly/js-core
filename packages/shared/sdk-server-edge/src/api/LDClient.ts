import { EventEmitter } from 'node:events';

import { Info, internal, LDClientImpl } from '@launchdarkly/js-server-sdk-common';

import EdgePlatform from '../platform';
import { LDOptionsInternal } from '../utils/validateOptions';
import createCallbacks from './createCallbacks';
import createOptions from './createOptions';

/**
 * The LaunchDarkly SDK edge client object.
 */
export default class LDClient extends LDClientImpl {
  emitter: EventEmitter;

  // clientSideID is only used to query the edge key-value store and send analytics, not to initialize with LD servers
  constructor(clientSideID: string, platformInfo: Info, options: LDOptionsInternal) {
    const em = new EventEmitter();
    const { additionalFetchOptions, ...remainingOptions } = options;
    const platform = new EdgePlatform(platformInfo, additionalFetchOptions);
    const internalOptions: internal.LDInternalOptions = {
      analyticsEventPath: `/events/bulk/${clientSideID}`,
      diagnosticEventPath: `/events/diagnostic/${clientSideID}`,
      includeAuthorizationHeader: false,
    };

    const finalOptions = createOptions(remainingOptions);

    super(
      clientSideID,
      platform,
      finalOptions,
      createCallbacks(em, finalOptions.logger),
      internalOptions,
    );
    this.emitter = em;
  }
}
