/**
 * The contents of this file are for event sampling. They are not used for
 * any purpose requiring cryptographic security.
 * */

export default function shouldSample(ratio: number) {
  const truncated = Math.trunc(ratio);
  // A radio of 1 means 1 in 1. So that will always sample. No need
  // to draw a random number.
  if (truncated === 1) {
    return true;
  }

  if (truncated === 0) {
    return false;
  }

  // Math.random() * truncated) would return 0, 1, ... (ratio - 1).
  // Checking for any number in the range will have approximately a 1 in X
  // chance. So we check for 0 as it is part of any range.
  return Math.floor(Math.random() * truncated) === 0;
}
