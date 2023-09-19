import { ClientContext, internal, subsystem } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { PlatformDom } from '../platform/PlatformDom';

const createEventProcessor = (
  clientSideID: string,
  config: Configuration,
  platform: PlatformDom,
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
