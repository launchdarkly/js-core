/**
 * @remark
 * This implementation is derived from `index.ts` of the `eventsource-parser` package,
 * version 4.1.1 (https://github.com/rexxars/eventsource-parser). See the LICENSE file at the
 * package root for the original license terms. The upstream `stream.ts` module (a TransformStream
 * wrapper) is not ported because nothing in this package uses it.
 */

export { ParseError } from './errors';
export type { ErrorType } from './errors';
export { createParser } from './parse';
export type { EventSourceMessage, EventSourceParser, ParserCallbacks, ParserConfig } from './types';
