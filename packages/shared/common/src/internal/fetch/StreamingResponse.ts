import type { Headers, Response, ResponseBody } from '../../api/platform/Requests';

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
   * Destroys the underlying stream. When the source provides this method, `cancel` uses
   * it to release the connection even while a read is in progress. A Node `Readable`
   * provides it.
   */
  destroy?(): void;
} & { [K in AsyncIteratorKey]: () => ResponseChunkIterator };

/**
 * Wraps the raw headers in the fetch `Headers` shape. Lookups are case-insensitive.
 * Multi-value headers are joined with ", ", and names without a value are skipped.
 */
function wrapRawHeaders(headers: RawHeaders): Headers {
  const normalized = new Map<string, string>();
  Object.keys(headers).forEach((key) => {
    const val = headers[key];
    if (val !== undefined && val !== null) {
      normalized.set(key.toLowerCase(), Array.isArray(val) ? val.join(', ') : val);
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
 * read hands out the next chunk from the source iterator. The `text` and `json` methods
 * read the remainder of the stream, so a caller uses either the reader or those methods,
 * not both. The `cancel` methods on the body and the reader destroy the source when it
 * provides a `destroy` method, and also call the iterator's `return` method when one
 * exists. The body passes through as-is, so the caller decodes any content encoding first.
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

  const cancel = async (): Promise<void> => {
    // Destroy the stream first. That rejects a pending read and unblocks a queued return
    // call. A Node readable iterator queues the return call behind a pending read, and on
    // a stream that was never read it completes without a destroy, so the return call
    // alone cannot release the connection. Do not await it for the same reason.
    source.destroy?.();
    iterator.return?.().catch(() => {});
  };

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
        cancel,
      }),
      cancel,
    },
    text,
    json: async () => JSON.parse(await text()),
  };
}
