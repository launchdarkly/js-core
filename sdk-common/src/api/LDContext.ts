import { LDMultiKindContext } from '../../../sdk-common/src/api/context/LDMultiKindContext';
import { LDSingleKindContext } from '../../../sdk-common/src/api/context/LDSingleKindContext';
import { LDUser } from './LDUser';

/**
 * A LaunchDarkly context object.
 */
export type LDContext = LDUser | LDSingleKindContext | LDMultiKindContext;
