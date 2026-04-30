import { LDLogger } from '@launchdarkly/js-server-sdk-common';

export const createCallbacks = (logger?: LDLogger) => ({
  onError: (err: Error) => {
    logger?.error?.(err.message);
  },
  onFailed: (_err: Error) => {},
  onReady: () => {},
  onUpdate: (_key: string) => {},
  hasEventListeners: () => false,
});
