// eslint-disable-next-line import/prefer-default-export
export const createCallbacks = () => ({
  onError: (_err: Error) => {},
  onFailed: (_err: Error) => {},
  onReady: () => {},
  onUpdate: (_key: string) => {},
  hasEventListeners: () => false,
});
