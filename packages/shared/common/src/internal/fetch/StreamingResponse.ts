import { Headers, Response, ResponseBody } from '../../api/platform/Requests';

// Each platform that constructs a streaming response provides the TextDecoder global. This
// package compiles without the global type libraries, so this scoped declaration stands in
// for it.
declare const TextDecoder: new () => { decode(input?: Uint8Array): string };

/**
 * The shape of raw HTTP headers: names mapped to a value, a list of values, or no value.
 * A Node `IncomingHttpHeaders` object satisfies this shape.
 */
export type RawHeaders = Record<string, string | string[] | undefined>;

/**
 * The source of response chunks. A platform provides the iterator from its own stream type.
 * For example, a Node `IncomingMessage` provides a compatible iterator through its
 * `Symbol.asyncIterator` method.
 */
export interface ResponseChunkIterator {
  /**
   * Resolves with the next chunk, or with `done: true` when the stream ends. Rejects when
   * the connection drops.
   */
  next(): Promise<{ done?: boolean; value?: Uint8Array }>;
}

/**
 * The key of the chunk iterator on a streaming response source. The compiled lib of a
 * consumer may not declare `Symbol.asyncIterator`. This conditional resolves to that symbol
 * when the lib declares it, and to no key at all otherwise. It keeps these declarations
 * valid for every consumer, like `AbortSignalLike` does for the abort signal.
 */
type AsyncIteratorKey = typeof Symbol extends { readonly asyncIterator: infer S }
  ? S extends keyof any
    ? S
    : never
  : never;

/**
 * The source of a streaming response: the metadata and the chunk stream. A Node
 * `IncomingMessage` satisfies this shape, so a platform can pass its message directly.
 */
export type StreamingResponseSource = {
  headers: RawHeaders;
  statusCode?: number;
  statusMessage?: string;
} & { [K in AsyncIteratorKey]: () => ResponseChunkIterator };

/**
 * Wraps the raw headers to match those used by fetch APIs.
 */
function wrapRawHeaders(headers: RawHeaders): Headers {
  function headerVal(name: string): string | null {
    const val = headers[name];
    if (val === undefined || val === null) {
      return null;
    }
    if (Array.isArray(val)) {
      return val.join(', ');
    }
    return val;
  }

  // We want to use generators here for the simplicity of maintaining
  // this interface. Also they aren't expected to be high frequency usage.
  function* entries(): Iterable<[string, string]> {
    for (const key of Object.keys(headers)) {
      const val = headerVal(key);
      if (val !== null) {
        yield [key, val];
      }
    }
  }

  function* values(): Iterable<string> {
    for (const [, val] of entries()) {
      yield val;
    }
  }

  return {
    get: headerVal,
    keys: () => Object.keys(headers),
    values,
    entries,
    // The callback receives the value first. The order matches the fetch `Headers.forEach`
    // signature. Multi-value headers are joined with a comma, and headers without a value
    // are skipped, like `entries`.
    forEach: (callback: (value: string, key: string) => void) => {
      for (const [key, value] of entries()) {
        callback(value, key);
      }
    },
    has: (name: string) => Object.prototype.hasOwnProperty.call(headers, name),
  };
}

/**
 * A response for a streaming request. Unlike the base response, the body and the status
 * message are always present.
 */
export interface StreamingResponse extends Response {
  body: ResponseBody;
  statusText: string;
}

/**
 * Creates a response for a streaming request. It does not buffer the body: each read hands
 * out the next chunk from the source iterator. The `text` and `json` methods read the
 * remainder of the stream, so a caller uses either the reader or those methods, not both.
 *
 * @param source The raw platform response, for example a Node `IncomingMessage`. A missing
 * status code maps to 0, and a missing status message maps to an empty string.
 */
export function createStreamingResponse(source: StreamingResponseSource): StreamingResponse {
  const iterator = source[Symbol.asyncIterator]();
  async function text(): Promise<string> {
    const chunks: Uint8Array[] = [];
    let length = 0;
    let next = await iterator.next();
    while (!next.done) {
      if (next.value) {
        chunks.push(next.value);
        length += next.value.length;
      }
      // The stream provides the chunks in sequence, so the reads cannot run in parallel.
      // eslint-disable-next-line no-await-in-loop
      next = await iterator.next();
    }
    const content = new Uint8Array(length);
    let offset = 0;
    chunks.forEach((chunk) => {
      content.set(chunk, offset);
      offset += chunk.length;
    });
    return new TextDecoder().decode(content);
  }

  return {
    headers: wrapRawHeaders(source.headers),
    status: source.statusCode ?? 0,
    statusText: source.statusMessage ?? '',
    body: {
      getReader: () => ({
        read: async () => {
          const next = await iterator.next();
          if (next.done) {
            return { done: true };
          }
          return { done: false, value: next.value };
        },
      }),
    },
    text,
    json: async () => JSON.parse(await text()),
  };
}
