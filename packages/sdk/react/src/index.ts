import { LDIsomorphicClient } from "./LDIsomorphicClient";
import { LDContext } from "@launchdarkly/js-client-sdk";
import { LDIsomorphicOptions } from "./LDIsomorphicOptions";

/**
 * Creates a new instance of the launchdarkly client.
 */
// @ts-expect-error - TODO: implement this
export function createClient(clientSideID: string, context: LDContext, options?: LDIsomorphicOptions): LDIsomorphicClient {
  
}
