import { TextEncoder, TextDecoder } from 'node:util';
import * as crypto from 'crypto';

global.TextEncoder = TextEncoder;

Object.assign(window, { TextDecoder, TextEncoder });

Object.defineProperty(global.self, "crypto", {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
    subtle: {
      digest: (algorithm, data) => {
        return new Promise((resolve, reject) =>
          resolve(
            crypto.createHash(algorithm.toLowerCase().replace("-", ""))
              .update(data)
              .digest()
          )
        );
      },
    },
  },
});
