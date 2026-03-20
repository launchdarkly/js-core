import {
  LDContext,
  LDEvaluationDetailTyped,
  LDFlagsState,
  LDFlagsStateOptions,
} from '@launchdarkly/js-server-sdk-common';

/**
 * A per-request evaluation scope that binds an {@link LDServerBaseClient} to a specific
 * {@link LDContext}.
 *
 * @remarks
 * This is idiomatic for React Server Components, where the context comes from the incoming
 * request (headers, cookies, auth tokens) and does not change during the render.
 *
 * Create a session with {@link createLDServerSession}.
 */
export interface LDServerSession {
  /**
   * Tests whether the underlying server client has completed initialization.
   *
   * @returns True if the client has successfully initialized.
   */
  initialized(): boolean;

  /**
   * Returns the context bound to this session.
   */
  getContext(): LDContext;

  /**
   * Determines the boolean variation of a feature flag for this session's context.
   */
  boolVariation(key: string, defaultValue: boolean): Promise<boolean>;

  /**
   * Determines the numeric variation of a feature flag for this session's context.
   */
  numberVariation(key: string, defaultValue: number): Promise<number>;

  /**
   * Determines the string variation of a feature flag for this session's context.
   */
  stringVariation(key: string, defaultValue: string): Promise<string>;

  /**
   * Determines the JSON variation of a feature flag for this session's context.
   *
   * This version is preferred in TypeScript because it returns `unknown` instead of `any`,
   * requiring an explicit cast before use.
   */
  jsonVariation(key: string, defaultValue: unknown): Promise<unknown>;

  /**
   * Determines the boolean variation of a feature flag, along with evaluation details.
   */
  boolVariationDetail(
    key: string,
    defaultValue: boolean,
  ): Promise<LDEvaluationDetailTyped<boolean>>;

  /**
   * Determines the numeric variation of a feature flag, along with evaluation details.
   */
  numberVariationDetail(
    key: string,
    defaultValue: number,
  ): Promise<LDEvaluationDetailTyped<number>>;

  /**
   * Determines the string variation of a feature flag, along with evaluation details.
   */
  stringVariationDetail(
    key: string,
    defaultValue: string,
  ): Promise<LDEvaluationDetailTyped<string>>;

  /**
   * Determines the JSON variation of a feature flag, along with evaluation details.
   */
  jsonVariationDetail(
    key: string,
    defaultValue: unknown,
  ): Promise<LDEvaluationDetailTyped<unknown>>;

  /**
   * Builds an object encapsulating the state of all feature flags for this session's context.
   *
   * The most common use case is bootstrapping client-side flags from a back-end service.
   * Call `toJSON()` on the returned object to get the data structure used by the client SDK.
   */
  allFlagsState(options?: LDFlagsStateOptions): Promise<LDFlagsState>;
}
