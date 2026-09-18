export const bom = [239, 187, 191];
export const colon = 58;
export const space = 32;
export const lineFeed = 10;
export const carriageReturn = 13;

export const MAX_OVER_ALLOCATION = 1024 * 1024; // 1 MiB

export function hasBom(buf: Uint8Array): boolean {
  return bom.every((charCode, index) => buf[index] === charCode);
}

/*
 * Helpers for the fetch transport.
 */

/**
 *
 * The parser decodes each field name and each field value as its own byte range. A `decode()`
 * call without `{ stream: true }` keeps no state between calls. One shared decoder is therefore
 * safe for unrelated ranges.
 *
 * The `ignoreBOM: true` flag keeps a leading U+FEFF in the output. Without the flag, the decoder
 * removes a leading U+FEFF from every decoded range. That removal corrupts a value that starts
 * with U+FEFF. The flag does not replace `hasBom()`. `hasBom()` removes the one byte order mark
 * that the SSE specification ignores at the start of the stream, before the parser reads any
 * bytes. The flag and `hasBom()` are complementary.
 */
export const utf8Decoder = new TextDecoder('utf-8', { ignoreBOM: true });

/**
 * The `Headers` class of `fetch()` rejects some values through its ByteString conversion: a C0
 * control character other than tab, DEL, and each code point above U+00FF. A value outside the
 * permitted set would make the Last-Event-ID header assignment throw on reconnect. That failure
 * would block the connection permanently.
 *
 * @remark
 * The original `launchdarkly-eventsource` implementation rejects only a NUL character; this stricter
 * rule is what a `fetch()` transport requires.
 */
export const INVALID_HEADER_VALUE_CHAR = /[^\t\x20-\x7e\x80-\xff]/;
