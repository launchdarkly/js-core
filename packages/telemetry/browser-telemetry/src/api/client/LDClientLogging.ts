import { MinLogger } from '../MinLogger';

/**
 * Minimal client interface which allows for loggng. Works with 4.x and higher versions of the javascript client.
 */
export interface LDClientLogging {
  readonly logger: MinLogger;
}
