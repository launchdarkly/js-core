import { ClientContext, internal, subsystem } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import { PlatformDom } from '../platform/PlatformDom';

const createEventProcessor = (
  clientSideID: string,
  config: Configuration,
  platform: PlatformDom,
): subsystem.LDEventProcessor =>
  config.sendEvents
    ? new internal.EventProcessor(
        // TODO: optimise config/clientcontext overlap
        { ...config, eventsCapacity: config.capacity },
        new ClientContext(clientSideID, config, platform),
      )
    : new internal.NullEventProcessor();

export default createEventProcessor;
