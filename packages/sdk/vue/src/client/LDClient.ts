import type {
  LDClient,
  LDContextStrict,
  LDWaitForInitializationResult,
} from '@launchdarkly/js-client-sdk';
import type { Ref } from 'vue';

/**
 * Represents the current initialization state of the LaunchDarkly client.
 */
export type InitializationStatus = LDWaitForInitializationResult | { status: 'initializing' };

/**
 * Initialization state of the client as a string union.
 * Derived from {@link InitializationStatus} for consistency.
 */
export type InitializedState = InitializationStatus['status'];

/**
 * The LaunchDarkly client interface for Vue.
 *
 * Extends the base {@link LDClient} with initialization-status and context-change subscriptions that
 * the Vue provider and composables use to react to `start()` and `identify()`.
 */
export interface LDVueClient extends LDClient {
  /**
   * Returns the initialization state of the client. Useful to determine whether the client can be
   * used to evaluate flags on initial render.
   */
  getInitializationState(): InitializedState;

  /**
   * Returns the error that caused initialization to fail, if any. Only set when
   * {@link getInitializationState} returns `'failed'`.
   */
  getInitializationError(): Error | undefined;

  /**
   * Subscribes to context changes triggered by `identify()`. The callback is invoked after each
   * successful `identify()` call (and once after a successful `start()`) with the resolved context.
   *
   * @returns An unsubscribe function.
   */
  onContextChange(callback: (context: LDContextStrict) => void): () => void;

  /**
   * Subscribes to initialization status changes. The callback fires when `start()` resolves. If the
   * client has already resolved, the callback is invoked immediately with the cached result.
   *
   * @returns An unsubscribe function.
   */
  onInitializationStatusChange(
    callback: (result: LDWaitForInitializationResult) => void,
  ): () => void;

  /**
   * Returns whether the client is ready to evaluate flags. True once initialization has completed
   * (successfully or not), or when bootstrap data was provided.
   */
  isReady(): boolean;
}

/**
 * The reactive value provided to Vue components via inject. Composables read from these refs.
 */
export interface LDVueInstance {
  /**
   * The LaunchDarkly client.
   */
  client: LDVueClient;

  /**
   * The current LaunchDarkly context. Undefined until the client has initialized.
   */
  context: Readonly<Ref<LDContextStrict | undefined>>;

  /**
   * The initialization state of the client.
   */
  initializedState: Readonly<Ref<InitializedState>>;

  /**
   * The error that caused the client to fail to initialize. Only set when `initializedState` is
   * `'failed'`.
   */
  error: Readonly<Ref<Error | undefined>>;
}
