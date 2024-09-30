// These classes are of trivial complexity. If they become
// more complex, then they could be independent files.
/* eslint-disable max-classes-per-file */

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
 * Check if the HTTP error is recoverable. This will return false if a request
 * made with any payload could not recover. If the reason for the failure
 * is payload specific, for instance a payload that is too large, then
 * it could recover with a different payload.
 */
export function isHttpRecoverable(status: number) {
  if (status >= 400 && status < 500) {
    return status === 400 || status === 408 || status === 429;
  }
  return true;
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
