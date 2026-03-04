import { calculatePollDelay } from '../../../src/datasource/fdv2/calculatePollDelay';

describe('calculatePollDelay', () => {
  it('returns 0 when freshness is undefined (poll immediately)', () => {
    expect(calculatePollDelay(undefined, 60000, 1000)).toBe(0);
  });

  it('returns remaining interval when data was recently received', () => {
    // Freshness at 1000, now at 1500, interval 2000 → 1500 remaining
    expect(calculatePollDelay(1000, 2000, 1500)).toBe(1500);
  });

  it('returns 0 when data is stale beyond poll interval', () => {
    // Freshness at 1000, now at 5000, interval 2000 → 0 (stale)
    expect(calculatePollDelay(1000, 2000, 5000)).toBe(0);
  });

  it('returns 0 when elapsed time exactly matches interval', () => {
    expect(calculatePollDelay(1000, 2000, 3000)).toBe(0);
  });

  it('returns full interval when freshness equals now', () => {
    expect(calculatePollDelay(5000, 60000, 5000)).toBe(60000);
  });
});
