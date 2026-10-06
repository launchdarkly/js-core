import { monotonicNow } from '../../src/utils/time';

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

it('falls back to the wall clock when no monotonic source exists', () => {
  const savedPerformance = (globalThis as any).performance;
  const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5678);
  delete (globalThis as any).performance;
  try {
    expect(monotonicNow()).toEqual(5678);
  } finally {
    nowSpy.mockRestore();
    (globalThis as any).performance = savedPerformance;
  }
});
