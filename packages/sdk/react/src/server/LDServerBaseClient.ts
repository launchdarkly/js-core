import {
  LDContext,
  LDEvaluationDetailTyped,
  LDFlagsState,
  LDFlagsStateOptions,
} from '@launchdarkly/js-server-sdk-common';

/**
 * A minimal structural interface that any LaunchDarkly server SDK that can be used with
 * {@link createLDServerSession} should satisfy.
 *
 * @remarks
 * This interface decouples the React SDK from the concrete `LDClient` type in
 * `@launchdarkly/js-server-sdk-common`, allowing edge SDKs and other custom
 * server client implementations to be used with {@link createLDServerSession}.
 *
 * @see {@link https://launchdarkly.github.io/js-core/packages/shared/sdk-server/docs/interfaces/LDClient.html}
 * for more information.
 */
export interface LDServerBaseClient {
  /**
   * Tests whether the client has completed initialization.
   *
   * @returns True if the client has successfully initialized.
   */
  initialized(): boolean;

  /**
   * Determines the boolean variation of a feature flag for a context.
   */
  boolVariation(key: string, context: LDContext, defaultValue: boolean): Promise<boolean>;

  /**
   * Determines the numeric variation of a feature flag for a context.
   */
  numberVariation(key: string, context: LDContext, defaultValue: number): Promise<number>;

  /**
   * Determines the string variation of a feature flag for a context.
   */
  stringVariation(key: string, context: LDContext, defaultValue: string): Promise<string>;

  /**
   * Determines the JSON variation of a feature flag for a context.
   *
   * This version is preferred in TypeScript because it returns `unknown` instead of `any`,
   * requiring an explicit cast before use.
   */
  jsonVariation(key: string, context: LDContext, defaultValue: unknown): Promise<unknown>;

  /**
   * Determines the boolean variation of a feature flag, along with evaluation details.
   */
  boolVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: boolean,
  ): Promise<LDEvaluationDetailTyped<boolean>>;

  /**
   * Determines the numeric variation of a feature flag, along with evaluation details.
   */
  numberVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: number,
  ): Promise<LDEvaluationDetailTyped<number>>;

  /**
   * Determines the string variation of a feature flag, along with evaluation details.
   */
  stringVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: string,
  ): Promise<LDEvaluationDetailTyped<string>>;

  /**
   * Determines the JSON variation of a feature flag, along with evaluation details.
   */
  jsonVariationDetail(
    key: string,
    context: LDContext,
    defaultValue: unknown,
  ): Promise<LDEvaluationDetailTyped<unknown>>;

  /**
   * Builds an object encapsulating the state of all feature flags for a given context.
   */
  allFlagsState(context: LDContext, options?: LDFlagsStateOptions): Promise<LDFlagsState>;
}
