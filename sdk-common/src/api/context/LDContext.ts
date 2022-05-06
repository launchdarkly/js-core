import { LDMultiKindContext } from './LDMultiKindContext';
import { LDSingleKindContext } from './LDSingleKindContext';
import { LDUser } from "./LDUser";

/**
 * A LaunchDarkly context object.
 */

export type LDContext = LDUser | LDSingleKindContext | LDMultiKindContext;
