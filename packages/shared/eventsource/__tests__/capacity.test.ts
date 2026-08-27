import calculateCapacity from '../src/capacity';

const maxOverAllocation = 1024 * 1024;

it('uses the minimum capacity', () => {
  const [resize, newCapacity] = calculateCapacity(0, 1, maxOverAllocation);
  expect(resize).toBe(true);
  expect(newCapacity).toEqual(Buffer.poolSize);
});

it('does not increase capacity when there is sufficient capacity', () => {
  const [resize, newCapacity] = calculateCapacity(1024, 1023, maxOverAllocation);
  expect(resize).toBe(false);
  expect(newCapacity).toEqual(0);
});

it('uses exponential doubling capacity scaling', () => {
  expect(calculateCapacity(8192, 8193, maxOverAllocation)).toEqual([true, 16384]);
  expect(calculateCapacity(16384, 16385, maxOverAllocation)).toEqual([true, 32768]);
});

it('uses required capacity when it exceeds doubling', () => {
  const [resize, newCapacity] = calculateCapacity(1024, 16384, maxOverAllocation);
  expect(resize).toBe(true);
  expect(newCapacity).toEqual(16384);
});

it('does not exceed max over allocation', () => {
  const capacity = 1024 * 1024 * 3;
  const [resize, newCapacity] = calculateCapacity(capacity, capacity + 1, maxOverAllocation);
  expect(resize).toBe(true);
  expect(newCapacity).toEqual(capacity + maxOverAllocation + 1);
});
