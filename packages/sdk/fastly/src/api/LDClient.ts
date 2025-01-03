import { Info, internal, LDClientImpl, LDOptions } from '@launchdarkly/js-server-sdk-common';

import EdgePlatform from '../platform';
import createCallbacks from './createCallbacks';
import createOptions from './createOptions';

/**
 * The LaunchDarkly SDK edge client object.
 */
export default class LDClient extends LDClientImpl {
  // clientSideID is only used to query the edge key-value store and send analytics, not to initialize with LD servers
  constructor(clientSideID: string, platformInfo: Info, options: LDOptions, eventsBackend: string) {
    const platform = new EdgePlatform(platformInfo, eventsBackend);
    const internalOptions: internal.LDInternalOptions = {
      analyticsEventPath: `/events/bulk/${clientSideID}`,
      diagnosticEventPath: `/events/diagnostic/${clientSideID}`,
      includeAuthorizationHeader: false,
    };

    const finalOptions = createOptions(options);

    super(clientSideID, platform, finalOptions, createCallbacks(), internalOptions);
  }
}
