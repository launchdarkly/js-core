import { LDFlagValue } from './LDFlagValue';

export interface LDFlagChangeset {
  [key: string]: {
    current: LDFlagValue;
    previous: LDFlagValue;
  };
}
