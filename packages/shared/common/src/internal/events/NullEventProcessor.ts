import { LDEventProcessor } from '../../api/subsystem';

export default class NullEventProcessor implements LDEventProcessor {
  close() {}

  async flush(): Promise<void> {
    // empty comment to keep ts and eslint happy
  }

  sendEvent() {}
}
