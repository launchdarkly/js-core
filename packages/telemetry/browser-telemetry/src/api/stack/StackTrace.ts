import { StackFrame } from './StackFrame';

/**
 * Represents a stack trace.
 */
export interface StackTrace {
  /**
   * Frames associated with the stack. If no frames can be collected, then this
   * will be an empty array.
   */
  frames: StackFrame[];
}
