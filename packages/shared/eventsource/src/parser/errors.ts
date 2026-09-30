/**
 * @remark
 * This implementation is derived from `errors.ts` of the `eventsource-parser` package,
 * version 4.1.1 (https://github.com/rexxars/eventsource-parser). See the LICENSE file at the
 * package root for the original license terms.
 */

/**
 * The type of error that occurred.
 * @public
 */
export type ErrorType = 'invalid-retry' | 'unknown-field' | 'max-buffer-size-exceeded';

/**
 * Error thrown when encountering an issue during parsing.
 *
 * @public
 */
export class ParseError extends Error {
  /**
   * The type of error that occurred.
   */
  type: ErrorType;

  /**
   * In the case of a completed unknown field encountered in the stream, this will be the field name.
   */
  field?: string | undefined;

  /**
   * In the case of a completed unknown field encountered in the stream, this will be the value of the field.
   */
  value?: string | undefined;

  /**
   * The line that caused the error, if available.
   */
  line?: string | undefined;

  constructor(
    message: string,
    options: { type: ErrorType; field?: string; value?: string; line?: string },
  ) {
    super(message);
    this.name = 'ParseError';
    this.type = options.type;
    this.field = options.field;
    this.value = options.value;
    this.line = options.line;
  }
}
