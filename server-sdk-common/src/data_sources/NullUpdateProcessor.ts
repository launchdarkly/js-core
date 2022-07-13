// This is an empty implementation, so it doesn't use this, and it has empty methods, and it
// has unused variables.
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { LDStreamProcessor } from '../api';

export default class NullUpdateProcessor implements LDStreamProcessor {
  start(fn?: ((err?: any) => void) | undefined) {
    // TODO: This was deferred in the other implementation, it has this comment,
    // but it has no why.
    // the start() callback should always be deferred
    setTimeout(() => fn?.(), 0);
  }

  stop() { }

  close() { }
}
