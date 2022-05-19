import { LDMultiKindContext } from './context/LDMultiKindContext';
import { LDSingleKindContext } from './context/LDSingleKindContext';
import { LDUser } from './LDUser';

/**
 * A LaunchDarkly context object.
 */
export type LDContext = LDUser | LDSingleKindContext | LDMultiKindContext;
