import { Context, LDContext } from "@launchdarkly/js-sdk-common"

/**
 * ActiveContextTracker is an internal class that helps tracks the current active context
 * used by the client.
 */
export interface ActiveContextTracker {
  _pristineContext?: LDContext
  _context?: Context

  /**
   * Set the active context and pristine context. This will only be called when the passed in context
   * is checked and valid.
   *
   * @param pristineContext - The pristine context, which is the context as it was passed in to the SDK.
   * @param context - The active context, which is the context as it was checked and validated.
   */
  set(pristineContext: LDContext, context: Context): void

  /**
   * Get the active context.
   *
   * @returns The active context or undefined if it has not been set.
   */
  getContext(): Context | undefined

  /**
   * Get the pristine context.
   *
   * @returns The pristine context or undefined if it has not been set.
   */
  getPristineContext(): LDContext | undefined

  /**
   * Create a new identification promise. To allow other parts of the SDK to track the identification process.
   * 
   * TODO(self): this is a very generic method so maybe it doesn't belong here?
   */
  newIdentificationPromise(): {
    identifyPromise: Promise<void>;
    identifyResolve: () => void;
    identifyReject: (err: Error) => void;
  }

  /**
   * Check if the active context is set. Regardless of whether it is valid or not.
   *
   * @returns True if the active context is set, false otherwise.
   */
  hasContext(): boolean

  /**
   * Check if the active context is valid.
   *
   * @returns True if the active context is valid, false otherwise.
   */
  hasValidContext(): boolean
}

export function createActiveContextTracker(): ActiveContextTracker {
  return {
    _pristineContext: undefined,
    _context: undefined,
    set(pristineContext: LDContext, context: Context) {
      this._pristineContext = pristineContext;
      this._context = context;
    },
    getContext() { return this._context; },
    getPristineContext() { return this._pristineContext; },
    newIdentificationPromise() {
      let res: () => void;
      let rej: (err: Error) => void;

      const basePromise = new Promise<void>((resolve, reject) => {
        res = resolve;
        rej = reject;
      });

      return { identifyPromise: basePromise, identifyResolve: res!, identifyReject: rej! };
    },
    hasContext() { return this._context !== undefined; },
    hasValidContext() { return this.hasContext() && this._context!.valid; },
  };
}
