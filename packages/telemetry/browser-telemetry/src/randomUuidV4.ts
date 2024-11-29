// This implementation is the same as in the browser package. Eventually we
// will want a common package for this type of code. (SDK-905)

// The implementation in this file generates UUIDs in v4 format and is suitable
// for use as a UUID in LaunchDarkly events. It is not a rigorous implementation.

// It uses crypto.randomUUID when available.
// If crypto.randomUUID is not available, then it uses random values and forms
// the UUID itself.
// When possible it uses crypto.getRandomValues, but it can use Math.random
// if crypto.getRandomValues is not available.

// UUIDv4 Struct definition.
// https://www.rfc-archive.org/getrfc.php?rfc=4122
// Appendix A.  Appendix A - Sample Implementation
const timeLow = {
  start: 0,
  end: 3,
};
const timeMid = {
  start: 4,
  end: 5,
};
const timeHiAndVersion = {
  start: 6,
  end: 7,
};
const clockSeqHiAndReserved = {
  start: 8,
  end: 8,
};
const clockSeqLow = {
  start: 9,
  end: 9,
};
const nodes = {
  start: 10,
  end: 15,
};

function getRandom128bit(): number[] {
  if (crypto && crypto.getRandomValues) {
    const typedArray = new Uint8Array(16);
    crypto.getRandomValues(typedArray);
    return [...typedArray.values()];
  }
  const values = [];
  for (let index = 0; index < 16; index += 1) {
    // Math.random is 0-1 with inclusive min and exclusive max.
    values.push(Math.floor(Math.random() * 256));
  }
  return values;
}

function hex(bytes: number[], range: { start: number; end: number }): string {
  let strVal = '';
  for (let index = range.start; index <= range.end; index += 1) {
    strVal += bytes[index].toString(16).padStart(2, '0');
  }
  return strVal;
}

/**
 * Given a list of 16 random bytes generate a UUID in v4 format.
 *
 * Note: The input bytes are modified to conform to the requirements of UUID v4.
 *
 * @param bytes A list of 16 bytes.
 * @returns A UUID v4 string.
 */
export function formatDataAsUuidV4(bytes: number[]): string {
  // https://www.rfc-archive.org/getrfc.php?rfc=4122
  // 4.4.  Algorithms for Creating a UUID from Truly Random or
  // Pseudo-Random Numbers

  // Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and
  // one, respectively.
  // eslint-disable-next-line no-bitwise, no-param-reassign
  bytes[clockSeqHiAndReserved.start] = (bytes[clockSeqHiAndReserved.start] | 0x80) & 0xbf;
  // Set the four most significant bits (bits 12 through 15) of the time_hi_and_version field to
  // the 4-bit version number from Section 4.1.3.
  // eslint-disable-next-line no-bitwise, no-param-reassign
  bytes[timeHiAndVersion.start] = (bytes[timeHiAndVersion.start] & 0x0f) | 0x40;

  return (
    `${hex(bytes, timeLow)}-${hex(bytes, timeMid)}-${hex(bytes, timeHiAndVersion)}-` +
    `${hex(bytes, clockSeqHiAndReserved)}${hex(bytes, clockSeqLow)}-${hex(bytes, nodes)}`
  );
}

export function fallbackUuidV4(): string {
  const bytes = getRandom128bit();
  return formatDataAsUuidV4(bytes);
}

export default function randomUuidV4(): string {
  if (typeof crypto !== undefined && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return fallbackUuidV4();
}
