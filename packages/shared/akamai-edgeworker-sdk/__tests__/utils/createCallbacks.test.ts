import { createCallbacks } from '../../src/utils/createCallbacks';

describe('create callback', () => {
  it('creates valid callbacks', () => {
    const callbacks = createCallbacks();
    expect(callbacks.onError).toBeDefined();
    expect(callbacks.onFailed).toBeDefined();
    expect(callbacks.onReady).toBeDefined();
    expect(callbacks.onUpdate).toBeDefined();
    expect(callbacks.hasEventListeners).toBeDefined();
  });

  it('has event listeners returns false', () => {
    const callbacks = createCallbacks();
    const hasEventListeners = callbacks.hasEventListeners();
    expect(hasEventListeners).toBe(false);
  });
});
