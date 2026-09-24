// These classes are of trivial complexity. If they become
// more complex, then they could be independent files.

export class LDUnexpectedResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyUnexpectedResponseError';
  }
}

export class LDClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyClientError';
  }
}

export class LDTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyTimeoutError';
  }
}

/**
 * How a failure is classified, which decides how long the next wait is.
 *
 * A 'normal' failure is one the service is expected to recover from without
 * intervention, so the wait stays short. An 'unexpected' failure suggests a
 * problem that requires a person to fix, such as a rejected credential, so the
 * wait becomes much longer. Neither classification ever means giving up; there
 * is always a next attempt.
 */
export type FailureKind = 'normal' | 'unexpected';

// HTTP statuses in the 4xx range that are still normal failures. Every other
// 4xx is unexpected.
const NORMAL_4XX_STATUSES = [400, 408, 429];

/**
 * Classifies an HTTP status.
 *
 * 400, 408, and 429 are normal, as is any 5xx. Every other 4xx, including 401
 * and 403, is unexpected. Anything outside the error ranges, including 0 for
 * "no response", is normal.
 */
export function classifyHttpStatus(status: number): FailureKind {
  if (status >= 400 && status < 500 && !NORMAL_4XX_STATUSES.includes(status)) {
    return 'unexpected';
  }
  return 'normal';
}

/**
 * Classifies a transport-level failure (connection refused or dropped, DNS
 * failure, timeout, TLS negotiation failure).
 *
 * Always normal: in an all-HTTPS system every transport error surfaces through
 * the TLS layer, so a certificate misconfiguration cannot be reliably
 * distinguished from a transient network fault, and treating transient faults
 * as unexpected would hold ordinary recoveries to multi-minute waits.
 */
export function classifyTransportFailure(): FailureKind {
  return 'normal';
}

/**
 * Check if the HTTP error is recoverable. This will return false if a request
 * made with any payload could not recover. If the reason for the failure
 * is payload specific, for instance a payload that is too large, then
 * it could recover with a different payload.
 *
 * Superseded by {@link classifyHttpStatus}, which this delegates to. It is
 * retained for the event-delivery pathway and is expected to be deprecated
 * once that pathway migrates to failure classification.
 */
export function isHttpRecoverable(status: number) {
  return classifyHttpStatus(status) === 'normal';
}

/**
 * Returns true if the status could recover for a different payload.
 *
 * When used with event processing this indicates that we should discard
 * the payload, but that a subsequent payload may succeed. Therefore we should
 * not stop event processing.
 */
export function isHttpLocallyRecoverable(status: number) {
  if (status === 413) {
    return true;
  }
  return isHttpRecoverable(status);
}
