export const createCallbacks = () => ({
  onError: (err: Error) => {},
  onFailed: (err: Error) => {},
  onReady: () => {},
  onUpdate: (key: string) => {},
  hasEventListeners: () => {
    return false;
  },
});
