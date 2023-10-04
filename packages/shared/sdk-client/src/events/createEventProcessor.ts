import { ClientContext, internal, Platform, subsystem } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';

const createEventProcessor = (
  clientSideID: string,
  config: Configuration,
  platform: Platform,
  diagnosticsManager?: internal.DiagnosticsManager,
): subsystem.LDEventProcessor =>
  config.sendEvents
    ? new internal.EventProcessor(
        { ...config, eventsCapacity: config.capacity },
        new ClientContext(clientSideID, config, platform),
        undefined,
        diagnosticsManager,
      )
    : new internal.NullEventProcessor();

export default createEventProcessor;
