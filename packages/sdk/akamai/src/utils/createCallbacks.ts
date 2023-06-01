/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line import/prefer-default-export
export const createCallbacks = () => ({
  onError: (err: Error) => {},
  onFailed: (err: Error) => {},
  onReady: () => {},
  onUpdate: (key: string) => {},
  hasEventListeners: () => false,
});
