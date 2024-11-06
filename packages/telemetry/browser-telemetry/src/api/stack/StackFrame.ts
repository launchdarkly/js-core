/**
 * Represents a frame in a stack.
 */
export default interface StackFrame {
  /**
   * The fileName, relative to the project root, of the stack frame.
   */
  fileName?: string;

  /**
   * The name of the function the frame occurs in.
   */
  function?: string;

  /**
   * The line number in the file where the frame originates.
   */
  line?: number;

  /**
   * The column in the file where the frame originates.
   */
  col?: number;

  /**
   * A number of source code lines before the line the frame originates from.
   *
   * The number of lines is configurable.
   */
  srcBefore?: string[];

  /**
   * The line of source code the frame originates from.
   *
   * This line may be partial if the line is too large.
   */
  srcLine?: string;

  /**
   * A number of source code lines after the line the frame originates from.
   *
   * The number of lines is configurable.
   */
  srcAfter?: string[];
}
