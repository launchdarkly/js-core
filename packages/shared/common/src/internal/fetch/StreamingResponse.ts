import type { Headers, Response, ResponseBody } from '../../api/platform/Requests';

// Each platform that constructs a streaming response provides the TextDecoder global. This
// package compiles without the global type libraries, so this scoped declaration stands in
// for it.
declare const TextDecoder: new () => {
  decode(input?: Uint8Array, options?: { stream?: boolean }): string;
};

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
   * the connection terminates before the server ends the stream. A chunk delivered together
   * with `done: true` is discarded, so the iterator must deliver the last chunk on its own.
   */
  next(): Promise<{ done?: boolean; value?: Uint8Array }>;

  /**
   * Releases the iterator. A Node `Readable` iterator queues this call behind a pending
   * read, so this call alone does not release an idle stream.
   */
  return?(): Promise<{ done?: boolean; value?: Uint8Array }>;
}

/**
 * The key of the chunk iterator on a streaming response source. A consumer's compile-time
 * lib may not declare `Symbol.asyncIterator`. This conditional resolves to that symbol when
 * the lib declares it, and to no key at all otherwise. That keeps these declarations valid
 * for every consumer, like `AbortSignalLike` does for the abort signal. Without the symbol,
 * the source type cannot require the iterator, and a source without a stream fails at run
 * time instead of compile time.
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

  /**
   * Destroys the underlying stream. `cancel` uses it to release the connection even while
   * a read is in progress. A Node `Readable` provides it. A source without it must release
   * through the iterator `return` method; a source whose `return` queues behind a pending
   * read, like a Node readable iterator, must provide `destroy` or `cancel` cannot release
   * it mid-read.
   */
  destroy?(): void;
} & { [K in AsyncIteratorKey]: () => ResponseChunkIterator };

/**
 * Wraps the raw headers in the fetch `Headers` shape. Lookups are case-insensitive.
 * Multi-value headers are joined with ", ", names that differ only by case merge into one
 * joined value, and names without a value are skipped.
 */
function wrapRawHeaders(headers: RawHeaders): Headers {
  const normalized = new Map<string, string>();
  Object.keys(headers).forEach((key) => {
    const val = headers[key];
    if (val !== undefined && val !== null) {
      const name = key.toLowerCase();
      const joined = Array.isArray(val) ? val.join(', ') : val;
      const existing = normalized.get(name);
      normalized.set(name, existing === undefined ? joined : `${existing}, ${joined}`);
    }
  });

  return {
    get: (name: string) => normalized.get(name.toLowerCase()) ?? null,
    keys: () => normalized.keys(),
    values: () => normalized.values(),
    entries: () => normalized.entries(),
    forEach: (callback: (value: string, key: string) => void) => {
      normalized.forEach((value, key) => callback(value, key));
    },
    has: (name: string) => normalized.has(name.toLowerCase()),
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
 * Creates a response for a streaming request. The response does not buffer the body. Each
 * read hands out the next chunk from the source iterator. The body permits one consumer:
 * the first `getReader`, `text`, or `json` call claims it, and a later call of any of the
 * three throws, like the lock of a standard body. The `cancel` methods on the body and the
 * reader call every release function the source provides: they destroy the source when it
 * has a `destroy` method, and they also call the iterator's `return` method when one
 * exists. The body passes through as-is, so the caller decodes any content encoding first.
 *
 * @param source The raw platform response, for example a Node `IncomingMessage`. A missing
 * status code maps to 0, and a missing status message maps to an empty string.
 */
export function createStreamingResponse(source: StreamingResponseSource): StreamingResponse {
  // A consumer compiled without `Symbol.asyncIterator` in its lib can pass a source that
  // lacks the iterator without a compile error. The check turns that mistake into a named
  // failure instead of a bare member-access TypeError.
  if (typeof source[Symbol.asyncIterator] !== 'function') {
    throw new TypeError('the streaming response source does not provide an async iterator');
  }
  const iterator = source[Symbol.asyncIterator]();

  let bodyUsed = false;
  const claimBody = (): void => {
    if (bodyUsed) {
      throw new TypeError('the response body is already in use');
    }
    bodyUsed = true;
  };

  const cancel = async (): Promise<void> => {
    // Destroy the stream first. That rejects a pending read and unblocks a queued return
    // call. A Node readable iterator queues the return call behind a pending read, and on
    // a stream that was never read it completes without a destroy, so the return call
    // alone cannot release the connection. Do not await it for the same reason. Each
    // release call is guarded on its own, so a release function that throws, or a return
    // that resolves synchronously, does not skip the other release path or reject cancel.
    try {
      source.destroy?.();
    } catch {
      // A throwing destroy has nothing left to release.
    }
    try {
      Promise.resolve(iterator.return?.()).catch(() => {});
    } catch {
      // A throwing return has nothing left to release.
    }
  };

  async function text(): Promise<string> {
    claimBody();
    const decoder = new TextDecoder();
    let result = '';
    let next = await iterator.next();
    while (!next.done) {
      if (next.value !== undefined) {
        try {
          result += decoder.decode(next.value, { stream: true });
        } catch {
          // decode() rejects a chunk that is not a BufferSource. The fixed message keeps
          // chunk contents out of error messages. text() owns the body, so a failed read
          // must release the source itself.
          cancel();
          throw new TypeError('the source supplied a chunk that is not a BufferSource');
        }
      }
      // The stream provides the chunks in sequence, so the reads cannot run in parallel.
      // oxlint-disable-next-line no-await-in-loop
      next = await iterator.next();
    }
    // The final decode flushes a trailing partial multi-byte sequence.
    return result + decoder.decode();
  }

  return {
    headers: wrapRawHeaders(source.headers),
    status: source.statusCode ?? 0,
    statusText: source.statusMessage ?? '',
    body: {
      getReader: () => {
        claimBody();
        return {
          read: async () => {
            const next = await iterator.next();
            if (next.done) {
              return { done: true };
            }
            return { done: false, value: next.value };
          },
          cancel,
        };
      },
      cancel,
    },
    text,
    json: async () => JSON.parse(await text()),
  };
}
