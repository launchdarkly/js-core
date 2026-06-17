const { TextEncoder, TextDecoder } = require('node:util');
const crypto = require('node:crypto');

global.TextEncoder = TextEncoder;

Object.assign(window, { TextDecoder, TextEncoder });

// jsdom doesn't provide crypto.subtle, which the SDK needs for context hashing.
// Based on: https://stackoverflow.com/a/71750830
Object.defineProperty(global.self, 'crypto', {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
    subtle: {
      digest: (algorithm, data) =>
        new Promise((resolve) =>
          resolve(
            crypto.createHash(algorithm.toLowerCase().replace('-', '')).update(data).digest(),
          ),
        ),
    },
  },
});

