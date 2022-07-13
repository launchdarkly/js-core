// This is an empty implementation, so it doesn't use this, and it has empty methods, and it
// has unused variables.
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import InputEvent from './InputEvent';
import LDEventProcessor from './LDEventProcessor';

/**
 * Empty event processor implementation for when events are not desired.
 * 
 * @internal
 */
export default class NullEventProcessor implements LDEventProcessor {
  close(): void {
  }

  async flush(): Promise<void> {
  }

  sendEvent(inputEvent: InputEvent): void {
  }
}
