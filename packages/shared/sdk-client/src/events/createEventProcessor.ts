import { ClientContext, internal, LDHeaders, Platform } from '@launchdarkly/js-sdk-common';

import ConfigurationImpl from '../configuration';

const createEventProcessor = (
  clientSideID: string,
  config: ConfigurationImpl,
  platform: Platform,
  baseHeaders: LDHeaders,
  diagnosticsManager?: internal.DiagnosticsManager,
): internal.EventProcessor | undefined => {
  if (config.sendEvents) {
    return new internal.EventProcessor(
      { ...config, eventsCapacity: config.capacity },
      new ClientContext(clientSideID, config, platform),
      baseHeaders,
      undefined,
      diagnosticsManager,
    );
  }

  return undefined;
};

export default createEventProcessor;
