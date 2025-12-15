import { Context, LDContext } from '@launchdarkly/js-sdk-common';

/**
 * ActiveContextTracker is an internal class that helps tracks the current active context
 * used by the client.
 */
export interface ActiveContextTracker {
  /**
   * Set the active context and unwrapped context. This will only be called when the passed in context
   * is checked and valid.
   *
   * @param unwrappedContext - The unwrapped context, which is the context as it was passed in to the SDK.
   * @param context - The active context, which is the context as it was checked and validated.
   */
  set(unwrappedContext: LDContext, context: Context): void;

  /**
   * Get the active context.
   *
   * @returns The active context or undefined if it has not been set.
   */
  getContext(): Context | undefined;

  /**
   * Get the unwrapped context.
   *
   * @returns The unwrapped context or undefined if it has not been set.
   */
  getUnwrappedContext(): LDContext | undefined;

  /**
   * Create a new identification promise. To allow other parts of the SDK to track the identification process.
   */
  newIdentificationPromise(): {
    identifyPromise: Promise<void>;
    identifyResolve: () => void;
    identifyReject: (err: Error) => void;
  };

  /**
   * Check if the active context is set. Regardless of whether it is valid or not.
   *
   * @returns True if the active context is set, false otherwise.
   */
  hasContext(): boolean;

  /**
   * Check if the active context is valid.
   *
   * @returns True if the active context is valid, false otherwise.
   */
  hasValidContext(): boolean;
}

export function createActiveContextTracker(): ActiveContextTracker {
  let unwrappedContext: LDContext | undefined;
  let context: Context | undefined;

  return {
    set(_unwrappedContext: LDContext, _context: Context) {
      unwrappedContext = _unwrappedContext;
      context = _context;
    },
    getContext() {
      return context;
    },
    getUnwrappedContext() {
      return unwrappedContext;
    },
    newIdentificationPromise() {
      let res: () => void;
      let rej: (err: Error) => void;

      const basePromise = new Promise<void>((resolve, reject) => {
        res = resolve;
        rej = reject;
      });

      return { identifyPromise: basePromise, identifyResolve: res!, identifyReject: rej! };
    },
    hasContext() {
      return context !== undefined;
    },
    hasValidContext() {
      return this.hasContext() && context!.valid;
    },
  };
}
