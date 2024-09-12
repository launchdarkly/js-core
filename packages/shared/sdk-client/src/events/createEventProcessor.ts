import { ClientContext, internal, LDHeaders, Platform } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';

const createEventProcessor = (
  clientSideID: string,
  config: Configuration,
  platform: Platform,
  baseHeaders: LDHeaders,
  diagnosticsManager?: internal.DiagnosticsManager,
  start: boolean = false,
): internal.EventProcessor | undefined => {
  if (config.sendEvents) {
    return new internal.EventProcessor(
      { ...config, eventsCapacity: config.capacity },
      new ClientContext(clientSideID, config, platform),
      baseHeaders,
      undefined,
      diagnosticsManager,
      start,
    );
  }

  return undefined;
};

export default createEventProcessor;
