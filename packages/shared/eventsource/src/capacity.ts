/**
 * Determine if a new capacity is needed for a buffer, and if it is, then what
 * that new capacity should be.
 *
 * @param currentCapacity The current capacity of the buffer.
 * @param requiredCapacity The required capacity from the buffer.
 * @param maxOverAllocation The maximum extra capacity to allocate. This is how much the capacity
 * can exceed the required capacity. If the over allocation exceeds this amount (from doubling),
 * then instead the amount over allocated will be equal to maxOverAllocation.
 *
 * @returns Either `[false, 0]` if no allocation is needed, or `[true, capacity]` if an allocation
 * is needed.
 */
export default function calculateCapacity(
  currentCapacity: number,
  requiredCapacity: number,
  maxOverAllocation: number,
): [boolean, number] {
  if (requiredCapacity > currentCapacity) {
    let newCapacity = requiredCapacity;

    // Might as well start with a buffer of the maximum size that can be pooled.
    // It is unlikely the initial buffer would be small enough to encounter
    // this case.
    if (newCapacity < Buffer.poolSize) {
      newCapacity = Buffer.poolSize;
    }

    // Exponential doubling capacity scaling.
    const doubleCapacity = currentCapacity * 2;
    if (newCapacity < doubleCapacity) {
      newCapacity = doubleCapacity;
    }

    // Doubling could become problematic over a certain size, so limit the total
    // amount of extra capacity allocated.
    const overAllocation = newCapacity - requiredCapacity;
    if (overAllocation > maxOverAllocation) {
      newCapacity = requiredCapacity + maxOverAllocation;
    }
    return [true, newCapacity];
  }
  return [false, 0];
}
