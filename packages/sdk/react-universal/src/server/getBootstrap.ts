import type { LDContext } from '@launchdarkly/node-server-sdk';

/**
 * Returns a json suitable for bootstrapping the js sdk.
 
 * @param context The LDContext to generate bootstrap for.
 * 
 * @returns A promise which resolves to a json object suitable for bootstrapping the js sdk.
 */
export const getBootstrap = async (context: LDContext) => {
  const allFlags = await global.nodeSdk.allFlagsState(context, { withReasons: true });
  return allFlags?.toJSON();
};
