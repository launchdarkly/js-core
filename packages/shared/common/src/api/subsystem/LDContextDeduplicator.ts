import Context from '../../Context';

/**
 * Interface for a strategy for removing duplicate contexts from the event stream.
 * Client side event processors do not do this de-duplication, so the implementation
 * is not part of the default event processor.
 */
export default interface LDContextDeduplicator {
  /**
   * The interval, if any, at which the event processor should call flush.
   */
  readonly flushInterval?: number;

  /**
   * Updates the internal state if necessary to reflect that we have seen the given context.
   * Returns true if it is time to insert an index event for this context into the event output.
   *
   * Client implementations may always return true.
   */
  processContext(context: Context): boolean;

  /**
   * Forgets any cached user information, so all subsequent contexts will be treated as new.
   */
  flush(): void;
}
