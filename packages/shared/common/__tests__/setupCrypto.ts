import { Hasher } from '../src/api';

class MockHasher implements Hasher {
  private state: string[] = [];

  update(value: string): Hasher {
    this.state.push(value);
    return this;
  }

  digest(): string {
    const result = this.state.join('');
    this.state = []; // Reset state after digest
    return result;
  }
}

export const setupCrypto = () => {
  let counter = 0;

  return {
    createHash: jest.fn(() => new MockHasher()),
    createHmac: jest.fn(),
    randomUUID: jest.fn(() => {
      counter += 1;
      // Will provide a unique value for tests.
      // Very much not a UUID of course.
      return `${counter}`;
    }),
  };
};
