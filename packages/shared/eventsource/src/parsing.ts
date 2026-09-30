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
