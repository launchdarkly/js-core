import { ClientContext, internal, LDEvent, Platform, subsystem } from '@launchdarkly/js-sdk-common';

import Configuration from '../configuration';
import EventSender from './EventSender';

const createEventProcessor = (config: Configuration): subsystem.LDEventProcessor => {
  return config.sendEvents
    ? new internal.EventProcessor(config, eventSender)
    : new internal.NullEventProcessor();
};

export default createEventProcessor;
