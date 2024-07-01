import { LDLogger } from '@launchdarkly/js-server-sdk-common';

// eslint-disable-next-line import/prefer-default-export
export const createCallbacks = (logger?: LDLogger) => ({
  onError: (err: Error) => {
    logger?.error?.(err.message);
  },
  onFailed: (_err: Error) => {},
  onReady: () => {},
  onUpdate: (_key: string) => {},
  hasEventListeners: () => false,
});
