import { Breadcrumb } from './Breadcrumb';
import { StackTrace } from './stack/StackTrace';

/**
 * Interface representing error data.
 */
export interface ErrorData {
  /**
   * The type of the error.
   */

  type: string;
  /**
   * A message associated with the error.
   */

  message: string;
  /**
   * The stack trace for the error.
   */

  stack: StackTrace;
  /**
   * Breadcrumbs leading up to the error.
   */

  breadcrumbs: Breadcrumb[];
  /**
   * The ID of the session during which the error occurred.
   */
  sessionId: string;
}
