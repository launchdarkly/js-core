import { ClientContext, internal, Platform } from '@launchdarkly/js-sdk-common';
import { EventProcessor } from '@launchdarkly/js-sdk-common/dist/internal';

import Configuration from '../configuration';

const createEventProcessor = (
  clientSideID: string,
  config: Configuration,
  platform: Platform,
  diagnosticsManager?: internal.DiagnosticsManager,
): EventProcessor | undefined =>
  config.sendEvents && config.connectionMode !== 'offline'
    ? new internal.EventProcessor(
        { ...config, eventsCapacity: config.capacity },
        new ClientContext(clientSideID, config, platform),
        undefined,
        diagnosticsManager,
      )
    : undefined;

export default createEventProcessor;
