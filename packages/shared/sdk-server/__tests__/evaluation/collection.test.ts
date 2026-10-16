import { allAsync, allSeriesAsync, firstSeriesAsync } from '../../src/evaluation/collection';

// The helpers do not guard the steps that run on the caller's stack; an exception there
// propagates to the caller as it always did. The two places where a step leaves that stack, a
// step deferred past the recursion limit and the promise chain in allAsync, route an exception to
// the optional onError so that the caller is not left waiting for a completion that never comes.

const SMALL = Array.from({ length: 5 }, (_, i) => i);
const LARGE = Array.from({ length: 60 }, (_, i) => i);

// A check result that lets the iteration continue to the next item: allSeriesAsync stops at the
// first false, firstSeriesAsync at the first true.
function continuing(continueWith: boolean) {
  return (_val: number, _index: number, cb: (res: boolean) => void) => {
    cb(continueWith);
  };
}

function throwingAt(failIndex: number, continueWith: boolean) {
  return (val: number, _index: number, cb: (res: boolean) => void) => {
    if (val === failIndex) {
      throw new Error(`check ${val} failed`);
    }
    cb(continueWith);
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe.each([
  ['allSeriesAsync', allSeriesAsync, true],
  ['firstSeriesAsync', firstSeriesAsync, false],
])('%s', (_name, helper, continueWith) => {
  // When every check lets the iteration continue, the aggregate is the continuing value: true
  // for allSeriesAsync (all passed) and false for firstSeriesAsync (none passed).
  it('calls cb with the aggregate result for a small collection', async () => {
    const cb = jest.fn();
    helper(SMALL, continuing(continueWith), cb, jest.fn());
    await settle();
    expect(cb).toHaveBeenCalledWith(continueWith);
  });

  it('calls cb with the aggregate result for a collection past the recursion limit', async () => {
    const cb = jest.fn();
    helper(LARGE, continuing(continueWith), cb, jest.fn());
    await settle();
    expect(cb).toHaveBeenCalledWith(continueWith);
  });

  it('propagates an exception from a step on the caller stack', () => {
    const cb = jest.fn();
    const onError = jest.fn();
    expect(() => helper(SMALL, throwingAt(2, continueWith), cb, onError)).toThrow('check 2 failed');
    expect(onError).not.toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
  });

  it('routes an exception from a step deferred past the recursion limit to onError', async () => {
    const cb = jest.fn();
    const onError = jest.fn();
    // Steps after the first run from a resolved promise, so a throw there is off the caller's
    // stack. Without onError it would be an unhandled rejection and cb would never be called.
    helper(LARGE, throwingAt(10, continueWith), cb, onError);
    await settle();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('check 10 failed');
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('allAsync', () => {
  it('calls cb with true when every check passes', async () => {
    const cb = jest.fn();
    allAsync(SMALL, (_val, cb2) => cb2(true), cb, jest.fn());
    await settle();
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('routes an exception from a check to onError', async () => {
    const cb = jest.fn();
    const onError = jest.fn();
    allAsync(
      SMALL,
      (val, cb2) => {
        if (val === 3) {
          throw new Error('check 3 failed');
        }
        cb2(true);
      },
      cb,
      onError,
    );
    await settle();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('check 3 failed');
    expect(cb).not.toHaveBeenCalled();
  });

  it('routes an exception from the completion callback to onError', async () => {
    const onError = jest.fn();
    allAsync(
      SMALL,
      (_val, cb2) => cb2(true),
      () => {
        throw new Error('completion failed');
      },
      onError,
    );
    await settle();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('completion failed');
  });
});
