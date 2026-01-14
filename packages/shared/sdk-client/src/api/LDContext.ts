import { LDContextCommon, LDSingleKindContext, LDUser } from '@launchdarkly/js-sdk-common';

export { LDContext as LDContextStrict } from '@launchdarkly/js-sdk-common';

/**
 * @see {@link LDSingleKindContext}
 *
 * The only difference is that the kind cannot be 'multi' which is reserved for multi-kind contexts.
 * Expect this change to be propogated to the common package in the future.
 *
 * @privateRemarks
 * This is helpful for type narrowing to avoid ambiguity when the kind is 'multi'.
 */
type strictSingleKindContext = Omit<LDSingleKindContext, 'kind' | 'key'> & {
  key: string;
  kind: Exclude<string, 'multi'>;
};

/**
 * An anonymous version of {@link LDSingleKindContext}. This is a valid form for contexts used in a
 * client-side sdk because the key will be generated if missing by the {@link ensureKey} function.
 */
type anonymousSingleKindContext = Omit<LDSingleKindContext, 'key' | 'anonymous' | 'kind'> & {
  key?: string;
  anonymous: true;
  kind: Exclude<string, 'multi'>;
};

/**
 * An anonymous version of {@link LDContextCommon}. This is a valid form for contexts used in a
 * client-side sdk because the key will be generated if missing by the {@link ensureKey} function.
 */
type anonymousLDContextCommon = Omit<LDContextCommon, 'key' | 'anonymous'> & {
  key?: string;
  anonymous: true;
};

/**
 * An anonymous version of {@link LDMultiKindContext}. This is a valid form for contexts used in a
 * client-side sdk because the keys will be generated if missing by the {@link ensureKey} function.
 */
interface multiKindContextWithAnonymous {
  kind: 'multi';
  [kind: string]: 'multi' | anonymousLDContextCommon | LDContextCommon;
}

/**
 * This is the client side version of the `LDContext` type (referred to as {@link LDContextStrict} in this module).
 * The key reason for this distinction is that client side contexts can be anonymous.
 * An anonymous context is a context that satisfies the following definition:
 * ```typescript
 * {
 *   key?: string;
 *   anonymous: true;
 * }
 * ```
 * > NOTE: A context with the `anonymous` property set to `false` or is `undefined` **MUST** have a `key`
 * > property set or it will be rejected by the SDK.
 *
 * Otherwise, refer to {@link LDContextStrict} for more details on how LaunchDarkly contexts work.
 *
 * @see {@link LDSingleKindContext}
 * @see {@link LDMultiKindContext}
 *
 * @remarks
 * Anonymous contexts are acceptable in the client side SDK because the SDK will generate a key for them if they are missing.
 * The key generation logic is in the {@link ensureKey} function.
 */
export type LDContext =
  | multiKindContextWithAnonymous
  | strictSingleKindContext
  | anonymousSingleKindContext
  | LDUser;
