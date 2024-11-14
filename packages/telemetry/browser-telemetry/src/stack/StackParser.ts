import { computeStackTrace } from 'tracekit';

import { StackFrame } from '../api/stack/StackFrame';
import { StackTrace } from '../api/stack/StackTrace';
import { ParsedStackOptions } from '../options';

/**
 * In the browser we will not always be able to determine the source file that code originates
 * from. When you access a route it may just return HTML with embedded source, or just source,
 * in which case there may not be a file name.
 *
 * There will also be cases where there is no source file, such as when running with various
 * dev servers.
 *
 * In these situations we use this constant in place of the file name.
 */
const INDEX_SPECIFIER = '(index)';

/**
 * For files hosted on the origin attempt to reduce to just a filename.
 * If the origin matches the source file, then the special identifier `(index)` will
 * be used.
 *
 * @param input The input URL.
 * @returns The output file name.
 */
export function processUrlToFileName(input: string, origin: string): string {
  let cleaned = input;
  if (input.startsWith(origin)) {
    cleaned = input.slice(origin.length);
    // If the input is a single `/` then it would get removed and we would
    // be left with an empty string. That empty string would get replaced with
    // the INDEX_SPECIFIER. In cases where a `/` remains, either singular
    // or at the end of a path, then we will append the index specifier.
    // For instance the route `/test/` would ultimately be `test/(index)`.
    if (cleaned.startsWith('/')) {
      cleaned = cleaned.slice(1);
    }

    if (cleaned === '') {
      return INDEX_SPECIFIER;
    }

    if (cleaned.endsWith('/')) {
      cleaned += INDEX_SPECIFIER;
    }
  }
  return cleaned;
}

export interface TrimOptions {
  /**
   * The maximum length of the trimmed line.
   */
  maxLength: number;

  /**
   * If the line needs to be trimmed, then this is the number of character to retain before the
   * originating character of the frame.
   */
  beforeColumnCharacters: number;
}

/**
 * Trim a source string to a reasonable size.
 *
 * @param options Configuration which affects trimming.
 * @param line The source code line to trim.
 * @param column The column which the stack frame originates from.
 * @returns A trimmed source string.
 */
export function trimSourceLine(options: TrimOptions, line: string, column: number): string {
  if (line.length <= options.maxLength) {
    return line;
  }
  const captureStart = Math.max(0, column - options.beforeColumnCharacters);
  const captureEnd = Math.min(line.length, captureStart + options.maxLength);
  return line.slice(captureStart, captureEnd);
}

/**
 * Given a context get trimmed source lines within the specified range.
 *
 * The context is a list of source code lines, this function returns a subset of
 * lines which have been trimmed.
 *
 * If an error is on a specific line of source code we want to be able to get
 * lines before and after that line. This is done relative to the originating
 * line of source.
 *
 * If you wanted to get 3 lines before the origin line, then this function would
 * need to be called with `start: originLine - 3, end: originLine`.
 *
 * If the `start` would underflow the context, then the start is set to 0.
 * If the `end` would overflow the context, then the end is set to the context
 * length.
 *
 * Exported for testing.
 *
 * @param start The inclusive start index.
 * @param end The exclusive end index.
 * @param trimmer Method which will trim individual lines.
 */
export function getLines(
  start: number,
  end: number,
  context: string[],
  trimmer: (val: string) => string,
): string[] {
  const adjustedStart = start < 0 ? 0 : start;
  const adjustedEnd = end > context.length ? context.length : end;
  if (adjustedStart < adjustedEnd) {
    return context.slice(adjustedStart, adjustedEnd).map(trimmer);
  }
  return [];
}

/**
 * Given a stack frame produce source context about that stack frame.
 *
 * The source context includes the source line of the stack frame, some number
 * of lines before the line of the stack frame, and some number of lines
 * after the stack frame. The amount of context can be controlled by the
 * provided options.
 *
 * Exported for testing.
 */
export function getSrcLines(
  inFrame: {
    // Tracekit returns null potentially. We accept undefined as well to be as lenient here
    // as we can.
    context?: string[] | null;
    column?: number | null;
  },
  options: ParsedStackOptions,
): {
  srcBefore?: string[];
  srcLine?: string;
  srcAfter?: string[];
} {
  const { context } = inFrame;
  // It should be present, but we don't want to trust that it is.
  if (!context) {
    return {};
  }
  const { maxLineLength } = options.source;
  const beforeColumnCharacters = Math.floor(maxLineLength / 2);

  // The before and after lines will not be precise while we use TraceKit.
  // By forking it we should be able to achieve a more optimal result.

  // Trimmer for non-origin lines. Starts at column 0.
  const trimmer = (input: string) =>
    trimSourceLine(
      {
        maxLength: options.source.maxLineLength,
        beforeColumnCharacters,
      },
      input,
      0,
    );

  const origin = Math.floor(context.length / 2);
  return {
    srcBefore: getLines(origin - options.source.beforeLines, origin, context, trimmer),
    srcLine: trimSourceLine(
      {
        maxLength: maxLineLength,
        beforeColumnCharacters,
      },
      context[origin],
      inFrame.column || 0,
    ),
    srcAfter: getLines(origin + 1, origin + 1 + options.source.afterLines, context, trimmer),
  };
}

/**
 * Parse the browser stack trace into a StackTrace which contains frames with specific fields parsed
 * from the free-form stack. Browser stack traces are not standardized, so implementations handling
 * the output should be resilient to missing fields.
 *
 * @param error The error to generate a StackTrace for.
 * @returns The stack trace for the given error.
 */
export default function parse(error: Error, options: ParsedStackOptions): StackTrace {
  const parsed = computeStackTrace(error);
  const frames: StackFrame[] = parsed.stack.reverse().map((inFrame) => ({
    fileName: processUrlToFileName(inFrame.url, window.location.origin),
    function: inFrame.func,
    line: inFrame.line,
    col: inFrame.column,
    ...getSrcLines(inFrame, options),
  }));
  return {
    frames,
  };
}
