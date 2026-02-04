import { LDContext } from '@launchdarkly/js-server-sdk-common';

/**
 * A provider for the LaunchDarkly context that can be used in
 * the server components.
 *
 * @privateRemarks
 * This interface is still under consideration and we will need to refine
 * this when we start to implement some examples to see how it works in practice.
 */
export interface LDContextProvider {
  /**
   * getContext is used to determine the context that should be
   * used for the request instance. This function will be called once
   * per request.
   *
   * @remarks
   * The reasons for this interface is that different frameworks may have
   * different ways to determine the context from a request.
   *
   * @returns The LDContext for the request.
   */
  getContext: () => LDContext;

  /**
   * setContext is used to set the context that should be
   * used for the request instance. This function will be called once
   * per request.
   *
   * @remarks
   * This is used to update the context that is associated with a
   * browser session. This is optional and if not provided, then we will
   * assume that the context is updated elsewhere.
   *
   * @param context The LDContext to set for the request.
   */
  setContext?: (context: LDContext) => void;
}
