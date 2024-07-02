// import ErrorStackParser from 'error-stack-parser';
import TraceKit, { computeStackTrace } from 'tracekit';

import StackFrame from './StackFrame';
import StackTrace from './StackTrace';

// @ts-ignore The typing for this is a bool, but it accepts a number.
TraceKit.linesOfContext = 1;

const MAX_SRC_LINE_LENGTH = 280;

/**
 * For files hosted on the origin attempt to reduce to just a filename.
 * If the origin matches the source file, then the special identifier `(index)` will
 * be used.
 *
 * @param input The input URL.
 * @returns The output file name.
 */
function processUrlToFileName(input: string): string {
  const { origin } = window.location;
  let cleaned = input;
  if (input.startsWith(origin)) {
    cleaned = input.slice(origin.length);
    if (cleaned.startsWith('/')) {
      cleaned = cleaned.slice(1);
    }
    if (cleaned === '') {
      cleaned = '(index)';
    }
  }
  return cleaned;
}

interface TrimOptions {
  /**
   * The maximum length of the trimmed line.
   */
  maxLength: number;

  /**
   * If the line needs trimmed, then this is the number of character to retain before the
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
function trimSourceLine(options: TrimOptions, line: string, column: number): string {
  if (line.length <= options.maxLength) {
    return line;
  }
  const captureStart = Math.max(0, column - options.beforeColumnCharacters);
  const captureEnd = Math.min(line.length, captureStart + options.maxLength);
  return line.slice(captureStart, captureEnd);
}

/**
 * Parse the browser stack trace into a StackTrace which contains frames with specific fields parsed
 * from the free-form stack. Browser stack traces are not standardized, so implementations handling
 * the output should be resilient to missing fields.
 *
 * @param error The error to generate a StackTrace for.
 * @returns The stack trace for the given error.
 */
export default function parse(error: Error): StackTrace {
  const parsed = computeStackTrace(error);
  const frames: StackFrame[] = parsed.stack.reverse().map((inFrame) => ({
    fileName: processUrlToFileName(inFrame.url),
    function: inFrame.func,
    line: inFrame.line,
    col: inFrame.column,
    srcLine: trimSourceLine(
      {
        maxLength: MAX_SRC_LINE_LENGTH,
        beforeColumnCharacters: MAX_SRC_LINE_LENGTH,
      },
      inFrame.context?.[0],
      inFrame.column,
    ),
  }));
  return {
    frames,
  };
}
