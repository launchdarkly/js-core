import { LDFlagValue } from './LDFlagValue';

/**
 * A map of feature flags from their keys to their values.
 */
export interface LDFlagSet {
  [key: string]: LDFlagValue;
}
