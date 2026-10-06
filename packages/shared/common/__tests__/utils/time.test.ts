import { monotonicNow } from '../../src/utils/time';

// The time source latches on the first call, so tests that need the wall-clock
// source load a fresh copy of the module inside jest.isolateModules.
function freshMonotonicNow(): () => number {
  let isolated: () => number;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    isolated = require('../../src/utils/time').monotonicNow;
  });
  return isolated!;
}

it('uses the performance clock when available', () => {
  const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(1234.5);
  try {
    expect(monotonicNow()).toEqual(1234.5);
  } finally {
    nowSpy.mockRestore();
  }
});

it('does not go backward across calls', () => {
  const first = monotonicNow();
  const second = monotonicNow();
  expect(second).toBeGreaterThanOrEqual(first);
});

it('reads the performance global live so a replaced clock takes effect', () => {
  monotonicNow();
  const savedPerformance = (globalThis as any).performance;
  (globalThis as any).performance = { now: () => 4321 };
  try {
    expect(monotonicNow()).toEqual(4321);
  } finally {
    (globalThis as any).performance = savedPerformance;
  }
});

it('falls back to the wall clock when no monotonic source exists', () => {
  const savedPerformance = (globalThis as any).performance;
  const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5678);
  delete (globalThis as any).performance;
  try {
    expect(freshMonotonicNow()()).toEqual(5678);
  } finally {
    nowSpy.mockRestore();
    (globalThis as any).performance = savedPerformance;
  }
});

it('keeps the wall clock when a performance global appears after the first call', () => {
  const savedPerformance = (globalThis as any).performance;
  const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5678);
  delete (globalThis as any).performance;
  try {
    const isolatedNow = freshMonotonicNow();
    expect(isolatedNow()).toEqual(5678);
    (globalThis as any).performance = savedPerformance;
    nowSpy.mockReturnValue(9999);
    expect(isolatedNow()).toEqual(9999);
  } finally {
    nowSpy.mockRestore();
    (globalThis as any).performance = savedPerformance;
  }
});
