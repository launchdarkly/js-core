import { LDClient } from '@launchdarkly/node-server-sdk';

/**
 * The LaunchDarkly server client interface for React.
 * 
 * @remarks
 * This is a restrictive version of the {@link LDClient} interface.
 * The main reason for this is to ensure we leverage client side
 * rendering appropriately for more dynamic content.
 * 
 * @see {@link LDReactServerOptions} for the possible options
 * 
 */
export interface LDReactServerClient extends Omit<LDClient, 'on'> {
}
