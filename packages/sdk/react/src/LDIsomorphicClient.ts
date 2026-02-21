import type {
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagValue,
} from '@launchdarkly/js-client-sdk';
import type { LDReactClient } from './client/LDClient';
import type { LDReactServerClient } from './server/LDClient';

/**
 * The LaunchDarkly isomorphic client interface.
 *
 * This is a common interface that can be used to create a client
 * that can be used on the server and client sides.
 *
 * Evaluation methods return Promises so the same API works in both
 * React Server Components (await in async components) and Client
 * Components.
 *
 * @privateRemarks
 * NOTE: This interface might be replaced by shared functions in the future which
 * may be better for tree shaking. Server types are imported with `import type`
 * so that client-only bundles do not include the server module.
 */
export interface LDIsomorphicClient extends Omit<
  LDReactClient,
  | 'waitForInitialization'
  | 'addHook'
  | 'variation'
  | 'variationDetail'
  | 'boolVariation'
  | 'boolVariationDetail'
  | 'numberVariation'
  | 'numberVariationDetail'
  | 'stringVariation'
  | 'stringVariationDetail'
  | 'jsonVariation'
  | 'jsonVariationDetail'
> {
  variation(key: string, defaultValue?: LDFlagValue): Promise<LDFlagValue>;
  variationDetail(key: string, defaultValue: LDFlagValue): Promise<LDEvaluationDetail>;
  boolVariation(key: string, defaultValue: boolean): Promise<boolean>;
  boolVariationDetail(key: string, defaultValue: boolean): Promise<LDEvaluationDetailTyped<boolean>>;
  numberVariation(key: string, defaultValue: number): Promise<number>;
  numberVariationDetail(key: string, defaultValue: number): Promise<LDEvaluationDetailTyped<number>>;
  stringVariation(key: string, defaultValue: string): Promise<string>;
  stringVariationDetail(key: string, defaultValue: string): Promise<LDEvaluationDetailTyped<string>>;
  jsonVariation(key: string, defaultValue: unknown): Promise<unknown>;
  jsonVariationDetail(key: string, defaultValue: unknown): Promise<LDEvaluationDetailTyped<unknown>>;

  /**
   * Federates this client with a server client so it can evaluate flags
   * in React Server Components. If never called, server-side evaluation
   * will no-op and return default values.
   *
   * @param serverClient A LaunchDarkly React server client from createReactServerClient
   * @returns this for chaining
   */
  useServerClient(serverClient: LDReactServerClient): this;
}
