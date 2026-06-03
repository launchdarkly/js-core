import { LDLogger } from '@launchdarkly/js-server-sdk-common';

// This is an empty callback since we Oxygen workers don't support event emitters.
export const createCallbacks = (logger?: LDLogger) => ({
  onError: (err: Error) => {
    logger?.error?.(err.message);
  },
  onFailed: (_err: Error) => {},
  onReady: () => {},
  onUpdate: (_key: string) => {},
  hasEventListeners: () => false,
});
