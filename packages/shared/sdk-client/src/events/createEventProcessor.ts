import { ClientContext, internal, subsystem } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { PlatformDom } from '../platform/PlatformDom';
import DiagnosticsManager from './DiagnosticsManager';

const createEventProcessor = (
  clientSideID: string,
  config: Configuration,
  platform: PlatformDom,
): subsystem.LDEventProcessor => {
  const { capacity, diagnosticOptOut, sendEvents } = config;
  const diagnosticsManager =
    sendEvents && !diagnosticOptOut
      ? new DiagnosticsManager(clientSideID, config, platform, platform.storage)
      : undefined;

  return sendEvents
    ? new internal.EventProcessor(
        { ...config, eventsCapacity: capacity },
        new ClientContext(clientSideID, config, platform),
        undefined,
        diagnosticsManager,
      )
    : new internal.NullEventProcessor();
};

export default createEventProcessor;
