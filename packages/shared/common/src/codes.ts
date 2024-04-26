// This code is automatically generated and should not be manually edited.

/**
 * Standardized log codes and messages.
*/
export class LogMessages {
  /**
   * Logs associated with the functionality of the client. Errors that can be covered by a more specific system, like "evaluation" should use that system.
  */
  static Client  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with SDK configuration.
  */
  static Configuration  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
      /**
       * There is a proxy configuration, and that configuration specifies to use TLS, but it is not using HTTPS authorization. This is likely not a desired configuration.
      */
      static ProxyTlsAuth = class {
        static readonly code = "0:2:0";
        /**
         * Generate a log string for this code.
         * 
         * This function will automatically include the log code.
        */
        static message(): string {
          return `0:2:0 Proxy configured with TLS options, but is not using HTTPS authentication.`;
        }
      }
    }
  }
  /**
   * Messages that apply to multiple data sources. Not specific to streaming or polling.
  */
  static DataSource  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
      /**
       * The connection has received invalid JSON. The error should have been logged with code 10:5:0. This debug log provides additional information. This should be logged after the error message.
      */
      static InvalidJsonDebug = class {
        static readonly code = "10:0:0";
        /**
         * Generate a log string for this code.
         * 
         * This function will automatically include the log code.
         * @param json The JSON data that was invalid.
        */
        static message(json: string): string {
          return `10:0:0 Invalid JSON follows: ${json}`;
        }
      }
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
      /**
       * The LaunchDarkly data source received a payload with invalid JSON.
      */
      static InvalidJson = class {
        static readonly code = "10:5:0";
        /**
         * Generate a log string for this code.
         * 
         * This function will automatically include the log code.
         * @param connection The type of the connection. Should be capitalized. Examples: "Streaming" or "Polling"
         * @param type The type of the message. For example "put", "patch", or "delete".
        */
        static message(connection: string, type: string): string {
          return `10:5:0 {$connection} connection received invalid data in "${type}" message.`;
        }
      }
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with evaluation.
  */
  static Evaluation  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with events.
  */
  static Events  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
      /**
       * Flushing of an event batch failed.
      */
      static FlushFailed = class {
        static readonly code = "8:0:0";
        /**
         * Generate a log string for this code.
         * 
         * This function will automatically include the log code.
         * @param error The reason the flush failed.
        */
        static message(error: string): string {
          return `8:0:0 Failed to flush events. Reason: ${error}`;
        }
      }
      /**
       * The event processor has started.
      */
      static EventProcessorStarted = class {
        static readonly code = "8:0:1";
        /**
         * Generate a log string for this code.
         * 
         * This function will automatically include the log code.
        */
        static message(): string {
          return `8:0:1 Started event processor.`;
        }
      }
      /**
       * The event processor is flushing events.
      */
      static FlushingEvents = class {
        static readonly code = "8:0:2";
        /**
         * Generate a log string for this code.
         * 
         * This function will automatically include the log code.
         * @param eventCount The number of events in the batch being flushed.
        */
        static message(eventCount: string): string {
          return `8:0:2 Flushing ${eventCount} events.`;
        }
      }
      /**
       * Event delivery failed, but a retry attempt is going to be made.
      */
      static EventRetry = class {
        static readonly code = "8:0:3";
        /**
         * Generate a log string for this code.
         * 
         * This function will automatically include the log code.
        */
        static message(): string {
          return `8:0:3 Encountered a problem sending events, will retry.`;
        }
      }
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
      /**
       * The capacity of the event queue was exceeded. The user may want to increase the capacity, or increase the frequency of flushing. In this situation some events have already been dropped. We only want to log this warning the first time it happens.
      */
      static EventCapacityExceeded = class {
        static readonly code = "8:4:0";
        /**
         * Generate a log string for this code.
         * 
         * This function will automatically include the log code.
        */
        static message(): string {
          return `8:4:0 Exceeded event queue capacity. Increase capacity, or decrease flushing interval, to avoid dropping events.`;
        }
      }
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with network conditions and failures. When possible use "streaming", "polling", or "events" instead, or log something in one of those systems in addition to the general network error. For instance an event source may log a "generalNetwork"  condition and the streaming data source a "sreaming" condition.
  */
  static GeneralNetwork  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with hooks.
  */
  static Hooks  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with the in-memory store for flags/segments.
  */
  static MemoryStore  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with a persistent store.
  */
  static PersistentStore  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with LaunchDarkly polling connections and payloads.
  */
  static Polling  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
  /**
   * Codes associated with LaunchDarkly streaming connections and payloads.
  */
  static Streaming  = class {
    /**
     * Codes associated with debugging.
    */
    static Debug = class {
    }
    /**
     * An error that should not happen in correctly implemented code. For instance missing a condition in a switch statement.
    */
    static ImplementationError = class {
    }
    /**
     * Codes for informative messages logged during normal operations.
    */
    static Informative = class {
    }
    /**
     * A non-usage error which interferes with operation and likely requires user intervention.
    */
    static RuntimeError = class {
    }
    /**
     * An unexpected, but recoverable, runtime issue not associated with usage.
    */
    static RuntimeWarning = class {
    }
    /**
     * An error which represents a mis-use of an API and impedes correct functionality.
    */
    static UsageError = class {
    }
    /**
     * A warning about the usage of an API or configuration. The usage or configuration does not interfere with operation, but is not recommended or may result in unexpected behavior.
    */
    static UsageWarning = class {
    }
  }
}
