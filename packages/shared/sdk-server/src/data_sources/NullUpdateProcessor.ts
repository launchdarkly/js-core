// This is an empty implementation, so it doesn't use this, and it has empty methods, and it
// has unused variables.

/* eslint-disable class-methods-use-this */

/* eslint-disable @typescript-eslint/no-empty-function */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { subsystem } from '@launchdarkly/js-sdk-common';

export default class NullUpdateProcessor implements subsystem.LDStreamProcessor {
  start(fn?: ((err?: any) => void) | undefined) {
    // Deferring the start callback should allow client construction to complete before we start
    // emitting events. Allowing the client an opportunity to register events.
    setTimeout(() => fn?.(), 0);
  }

  stop() {}

  close() {}
}
