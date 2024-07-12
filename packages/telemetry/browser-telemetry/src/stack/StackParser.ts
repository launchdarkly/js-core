import { computeStackTrace } from 'tracekit';

import StackFrame from './StackFrame';
import StackTrace from './StackTrace';

const MAX_SRC_LINE_LENGTH = 280;
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
    if (cleaned.startsWith('/')) {
      cleaned = cleaned.slice(1);
    }
    if (cleaned === '') {
      cleaned = INDEX_SPECIFIER;
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
export function trimSourceLine(options: TrimOptions, line: string, column: number): string {
  if (line.length <= options.maxLength) {
    return line;
  }
  const captureStart = Math.max(0, column - options.beforeColumnCharacters);
  const captureEnd = Math.min(line.length, captureStart + options.maxLength);
  return line.slice(captureStart, captureEnd);
}

function getSrcLines(
  inContext: string[],
  line: number,
): {
  srcBefore: string[];
  srcLine: string;
  srcAfter: string[];
} {
  return {
    srcBefore: [],
    srcLine: '',
    srcAfter: [],
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
export default function parse(error: Error): StackTrace {
  const parsed = computeStackTrace(error);
  const frames: StackFrame[] = parsed.stack.reverse().map((inFrame) => ({
    // TODO: Extract window dependencies into a platform.
    fileName: processUrlToFileName(inFrame.url, window.location.origin),
    function: inFrame.func,
    line: inFrame.line,
    col: inFrame.column,
    srcBefore: [],
    srcLine: trimSourceLine(
      {
        maxLength: MAX_SRC_LINE_LENGTH,
        beforeColumnCharacters: MAX_SRC_LINE_LENGTH,
      },
      inFrame.context?.[0],
      inFrame.column,
    ),
    srcAfter: [],
  }));
  return {
    frames,
  };
}
